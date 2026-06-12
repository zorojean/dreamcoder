import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test'
import type { ServerWebSocket } from 'bun'
import {
  __resetWebSocketHandlerStateForTests,
  closeSessionConnection,
  getActiveSessionIds,
  handleWebSocket,
  type WebSocketData,
} from '../ws/handler.js'
import { ConversationStartupError, conversationService } from '../services/conversationService.js'
import { computerUseApprovalService } from '../services/computerUseApprovalService.js'
import { sessionService } from '../services/sessionService.js'

function makeClientSocket(sessionId: string) {
  const sent: string[] = []
  return {
    data: {
      sessionId,
      connectedAt: Date.now(),
      channel: 'client',
      sdkToken: null,
      serverPort: 0,
      serverHost: '127.0.0.1',
    },
    send: mock((payload: string) => {
      sent.push(payload)
    }),
    close: mock(() => {}),
    sent,
  } as unknown as ServerWebSocket<WebSocketData> & { sent: string[] }
}

async function waitForSentMessage(
  ws: { sent: string[] },
  predicate: (message: unknown) => boolean,
): Promise<unknown> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    for (const payload of ws.sent) {
      const message = JSON.parse(payload)
      if (predicate(message)) return message
    }
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
  throw new Error(`Timed out waiting for sent message. Sent: ${ws.sent.join('\n')}`)
}

describe('WebSocket handler session isolation', () => {
  afterEach(() => {
    __resetWebSocketHandlerStateForTests()
    mock.restore()
  })

  it('ignores stale disconnects from an older socket for the same session', () => {
    const sessionId = `duplicate-${crypto.randomUUID()}`
    const first = makeClientSocket(sessionId)
    const second = makeClientSocket(sessionId)
    const clearCallbacks = spyOn(conversationService, 'clearOutputCallbacks')
    const cancelComputerUse = spyOn(computerUseApprovalService, 'cancelSession')

    handleWebSocket.open(first)
    handleWebSocket.open(second)
    clearCallbacks.mockClear()
    cancelComputerUse.mockClear()

    handleWebSocket.close(first, 1000, 'stale tab closed')

    expect(getActiveSessionIds()).toContain(sessionId)
    expect(clearCallbacks).not.toHaveBeenCalled()
    expect(cancelComputerUse).not.toHaveBeenCalled()
  })

  it('closes and removes an active client socket when a session is deleted', () => {
    const sessionId = `delete-${crypto.randomUUID()}`
    const ws = makeClientSocket(sessionId)
    const clearCallbacks = spyOn(conversationService, 'clearOutputCallbacks')
    const cancelComputerUse = spyOn(computerUseApprovalService, 'cancelSession')

    handleWebSocket.open(ws)

    expect(closeSessionConnection(sessionId, 'session deleted')).toBe(true)

    expect(getActiveSessionIds()).not.toContain(sessionId)
    expect(ws.close).toHaveBeenCalledWith(1000, 'session deleted')
    expect(clearCallbacks).toHaveBeenCalledWith(sessionId)
    expect(cancelComputerUse).toHaveBeenCalledWith(sessionId)
  })

  it('replays pending permission requests when a client reconnects', () => {
    const sessionId = `permission-reconnect-${crypto.randomUUID()}`
    const ws = makeClientSocket(sessionId)
    spyOn(conversationService, 'hasSession').mockReturnValue(true)
    spyOn(conversationService, 'onOutput').mockImplementation(() => {})
    spyOn(conversationService, 'removeOutputCallback').mockImplementation(() => {})
    spyOn(conversationService, 'getPendingPermissionRequests').mockReturnValue([
      {
        requestId: 'request-ask-1',
        toolName: 'AskUserQuestion',
        toolUseId: 'tool-ask-1',
        input: {
          questions: [
            {
              header: 'Scope',
              question: 'Which scope?',
              options: [{ label: 'A', description: 'First' }, { label: 'B', description: 'Second' }],
            },
          ],
        },
        description: 'Answer questions?',
      },
    ])

    handleWebSocket.open(ws)

    expect(ws.sent.map((payload) => JSON.parse(payload))).toContainEqual({
      type: 'permission_request',
      requestId: 'request-ask-1',
      toolName: 'AskUserQuestion',
      toolUseId: 'tool-ask-1',
      input: {
        questions: [
          {
            header: 'Scope',
            question: 'Which scope?',
            options: [{ label: 'A', description: 'First' }, { label: 'B', description: 'Second' }],
          },
        ],
      },
      description: 'Answer questions?',
    })
  })

  it('keeps disconnected sessions alive longer while user input is pending', () => {
    const sessionId = `permission-disconnect-${crypto.randomUUID()}`
    const ws = makeClientSocket(sessionId)
    const setTimeoutSpy = spyOn(globalThis, 'setTimeout').mockImplementation(() => 0 as any)
    spyOn(conversationService, 'getPendingPermissionRequests').mockReturnValue([
      {
        requestId: 'request-ask-1',
        toolName: 'AskUserQuestion',
        toolUseId: 'tool-ask-1',
        input: { questions: [] },
      },
    ])

    handleWebSocket.open(ws)
    setTimeoutSpy.mockClear()

    handleWebSocket.close(ws, 1006, 'renderer reconnecting')

    expect(setTimeoutSpy).toHaveBeenCalled()
    expect(setTimeoutSpy.mock.calls[0]?.[1]).toBeGreaterThan(30_000)
  })

  it('sends a visible error when session prewarm startup fails', async () => {
    const sessionId = crypto.randomUUID()
    const ws = makeClientSocket(sessionId)
    spyOn(conversationService, 'hasSession').mockReturnValue(false)
    spyOn(conversationService, 'startSession').mockRejectedValue(
      new ConversationStartupError(
        'No conversation found with session ID: ' + sessionId,
        'CLI_START_FAILED',
      ),
    )

    handleWebSocket.open(ws)
    handleWebSocket.message(ws, JSON.stringify({ type: 'prewarm_session' }))

    await expect(waitForSentMessage(ws, (message) =>
      !!message &&
      typeof message === 'object' &&
      (message as { type?: unknown }).type === 'error',
    )).resolves.toEqual({
      type: 'error',
      message: 'No conversation found with session ID: ' + sessionId,
      code: 'CLI_START_FAILED',
      retryable: false,
    })
  })

  it('does not prewarm historical transcript sessions', async () => {
    const sessionId = crypto.randomUUID()
    const ws = makeClientSocket(sessionId)
    spyOn(conversationService, 'hasSession').mockReturnValue(false)
    const startSession = spyOn(conversationService, 'startSession').mockResolvedValue()
    spyOn(sessionService, 'getSessionLaunchInfo').mockResolvedValue({
      filePath: '/tmp/session.jsonl',
      projectDir: process.cwd(),
      workDir: process.cwd(),
      worktreeSession: null,
      transcriptMessageCount: 2,
      customTitle: null,
    })

    handleWebSocket.open(ws)
    handleWebSocket.message(ws, JSON.stringify({ type: 'prewarm_session' }))
    await new Promise((resolve) => setTimeout(resolve, 5))

    expect(startSession).not.toHaveBeenCalled()
  })
})
