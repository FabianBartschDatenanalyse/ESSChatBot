import React from 'react';
import '@testing-library/jest-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AskAiPanel from './ask-ai-panel'; // ⬅️ Passe den Pfad ggf. an
import { describe, expect, it, vi } from 'vitest';
import { Conversation } from '@/lib/types';

// 1. Mock für die AI-Funktion
vi.mock('@/ai/flows/main-assistant-flow', () => ({
    mainAssistant: vi.fn().mockResolvedValue({
      answer: 'This is a test answer.',
      sqlQuery: 'SELECT * FROM test_table;',
      retrievedContext: 'This is some test context.',
    }),
  }));
  

describe('AskAiPanel', () => {
    const mockConversation: Conversation = {
        id: 'test-convo',
        title: 'Test Conversation',
        messages: [],
      };
      

  const mockOnMessagesUpdate = vi.fn();

  it('sends a question and displays the assistant response', async () => {
    render(<AskAiPanel conversation={mockConversation} onMessagesUpdate={mockOnMessagesUpdate} />);
  
    const input = screen.getByPlaceholderText(/what is the average trust/i);
    fireEvent.change(input, { target: { value: 'What is the capital of France?' } });
  
    const sendButton = screen.getByRole('button');
    fireEvent.click(sendButton);
  
    await waitFor(() => {
      expect(screen.getByText('This is a test answer.')).toBeInTheDocument();
    });
  
    const showDetailsButton = screen.getByRole('button', { name: /show details/i });
    fireEvent.click(showDetailsButton);
  
    expect(screen.getByText(/SELECT \*/)).toBeInTheDocument();
    expect(screen.getByText(/This is some test context/)).toBeInTheDocument();
  });
});
