/**
 * useElevenLabs - ElevenLabs Conversational AI integration
 *
 * Wraps the ElevenLabs React SDK to provide voice agent functionality.
 * Manages conversation sessions, message sending, and connection state.
 */

import { useState, useCallback } from 'react';
import { useConversation } from '@elevenlabs/react';

const BACKEND_API_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const ELEVENLABS_AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID || '';

export interface UseElevenLabsReturn {
  isConnected: boolean;
  isSpeaking: boolean;
  conversationId: string | null;
  startConversation: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  endConversation: () => Promise<void>;
  error: Error | null;
}

export function useElevenLabs(): UseElevenLabsReturn {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // ElevenLabs React SDK conversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log('[ElevenLabs] Aegis voice agent connected');
      setError(null);
    },
    onDisconnect: () => {
      console.log('[ElevenLabs] Aegis voice agent disconnected');
      setConversationId(null);
    },
    onMessage: (message) => {
      // Handle messages from ElevenLabs agent
      console.log('[ElevenLabs] Message from Aegis:', message);
    },
    onError: (err) => {
      console.error('[ElevenLabs] Error:', err);
      setError(err);
    },
  });

  /**
   * Start a new conversation session with Aegis voice agent
   */
  const startConversation = useCallback(async () => {
    try {
      setError(null);

      // Initialize conversation session with backend
      const response = await fetch(`${BACKEND_API_URL}/api/voice/conversation/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Failed to start conversation: ${response.statusText}`);
      }

      type ConversationStartResponse = {
        conversation_id: string;
        agent_id?: string | null;
        signed_url?: string | null;
      };

      const data: ConversationStartResponse = await response.json();
      setConversationId(data.conversation_id);

      const agentId = data.agent_id || ELEVENLABS_AGENT_ID;
      const signedUrl = data.signed_url;
      if (!signedUrl && !agentId) {
        throw new Error(
          'ElevenLabs agent configuration missing. Please verify ELEVENLABS_AGENT_ID and API key are set on the backend.'
        );
      }

      // Start ElevenLabs session
      if (signedUrl) {
        await conversation.startSession({
          signedUrl,
          connectionType: 'websocket',
        });
      } else {
        await conversation.startSession({
          agentId,
        });
      }

      console.log('[ElevenLabs] Conversation started:', data.conversation_id);
    } catch (err) {
      console.error('[ElevenLabs] Failed to start conversation:', err);
      setError(err as Error);
      throw err;
    }
  }, [conversation]);

  /**
   * Send a text message to the voice agent
   */
  const sendMessage = useCallback(
    async (text: string) => {
      if (conversation.status !== 'connected') {
        console.warn('[ElevenLabs] Cannot send message: not connected');
        return;
      }

      try {
        await conversation.sendMessage(text);
        console.log('[ElevenLabs] Message sent:', text);
      } catch (err) {
        console.error('[ElevenLabs] Failed to send message:', err);
        setError(err as Error);
        throw err;
      }
    },
    [conversation]
  );

  /**
   * End the current conversation session
   */
  const endConversation = useCallback(async () => {
    try {
      await conversation.endSession();

      // Notify backend that conversation ended
      if (conversationId) {
        await fetch(`${BACKEND_API_URL}/api/voice/conversation/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_id: conversationId }),
        });
      }

      setConversationId(null);
      console.log('[ElevenLabs] Conversation ended');
    } catch (err) {
      console.error('[ElevenLabs] Failed to end conversation:', err);
      setError(err as Error);
      throw err;
    }
  }, [conversation, conversationId]);

  return {
    isConnected: conversation.status === 'connected',
    isSpeaking: conversation.isSpeaking,
    conversationId,
    startConversation,
    sendMessage,
    endConversation,
    error,
  };
}
