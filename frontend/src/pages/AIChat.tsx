import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Plus,
  Trash2,
  Sparkles,
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  BookOpen,
  Info,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import { chatApi } from '../services/api';
import { ChatConversation, ChatMessage } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useToast } from '../context/ToastContext';

export const AIChat: React.FC = () => {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Speech Recognition & TTS State
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { success, error, warning, info } = useToast();

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check speech recognition support
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
        info(`Voice heard: "${transcript}"`);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
        warning('Speech input paused or not recognized.');
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Load conversations
  const loadConversations = async () => {
    try {
      setLoading(true);
      const convs = await chatApi.getConversations();
      setConversations(convs);
      if (convs.length > 0 && !activeConversationId) {
        selectConversation(convs[0].id);
      }
    } catch (err) {
      error('Failed to load chat history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  const selectConversation = async (id: number) => {
    setActiveConversationId(id);
    try {
      const detail = await chatApi.getConversationDetail(id);
      setMessages(detail.messages || []);
    } catch (err) {
      error('Failed to load conversation messages.');
    }
  };

  const handleStartNewChat = async () => {
    try {
      const newConv = await chatApi.createConversation('New Academic Consultation');
      setConversations([newConv, ...conversations]);
      setActiveConversationId(newConv.id);
      setMessages([]);
      success('Started a fresh academic consultation.');
    } catch (err) {
      error('Could not initialize conversation.');
    }
  };

  const handleDeleteConversation = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this conversation history?')) return;
    try {
      await chatApi.deleteConversation(id);
      const filtered = conversations.filter((c) => c.id !== id);
      setConversations(filtered);
      if (activeConversationId === id) {
        if (filtered.length > 0) {
          selectConversation(filtered[0].id);
        } else {
          setActiveConversationId(null);
          setMessages([]);
        }
      }
      success('Conversation deleted.');
    } catch (err) {
      error('Failed to delete conversation.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || sending) return;

    const text = inputMessage.trim();
    setInputMessage('');

    // Optimistically show user message
    const tempUserMsg: ChatMessage = {
      id: Date.now(),
      conversation_id: activeConversationId || 0,
      role: 'user',
      content: text,
      is_demo: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    setSending(true);
    try {
      const resp = await chatApi.sendMessage({
        message: text,
        conversation_id: activeConversationId || undefined,
      });

      // Update active conversation ID if it was freshly spawned
      if (!activeConversationId && resp.conversation_id) {
        setActiveConversationId(resp.conversation_id);
        loadConversations();
      }

      setMessages((prev) => [...prev, resp]);
    } catch (err: any) {
      error('Failed to generate response.');
    } finally {
      setSending(false);
    }
  };

  // Toggle voice input
  const toggleListening = () => {
    if (!speechSupported) {
      warning('Browser speech recognition is not supported in this browser.');
      return;
    }
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
        info('Listening... Speak your academic question.');
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Read response aloud (TTS)
  const handleSpeak = (text: string) => {
    if (!('speechSynthesis' in window)) {
      warning('Browser speech synthesis is not supported.');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const cleanText = text.replace(/\[DEMO MODE.*?\]/g, '').replace(/[*#_`]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // Preset quick question chips
  const quickPrompts = [
    "What classes do I have today?",
    "Which assignments are due next?",
    "What is my current attendance percentage in CS603?",
    "Summarize the Raft Consensus notes in my vault.",
    "Which subjects need extra revision based on my marks?",
  ];

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row rounded-3xl bg-white border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Left Pane: Conversations History Sidebar */}
      <div className="w-full md:w-64 border-r border-slate-200/80 flex flex-col bg-slate-50/50">
        <div className="p-3.5 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Bot className="w-4 h-4 text-brand-600" />
            <span className="text-xs font-bold text-slate-800">Academic Chats</span>
          </div>
          <button
            onClick={handleStartNewChat}
            className="p-1.5 text-brand-600 hover:text-white hover:bg-brand-600 rounded-lg transition-colors"
            title="New Conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-[11px] text-slate-400 text-center py-6">
              No previous consultations.
            </p>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => selectConversation(c.id)}
                className={`p-2.5 rounded-xl text-xs font-semibold cursor-pointer flex items-center justify-between group transition-all ${
                  activeConversationId === c.id
                    ? 'bg-brand-50 text-brand-700 border border-brand-200/80 shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="truncate pr-2">{c.title}</span>
                <button
                  onClick={(e) => handleDeleteConversation(c.id, e)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 transition-opacity"
                  title="Delete chat"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Pane: Active Chat Conversation */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Chat Banner Info */}
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/40 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900 leading-tight">
                Academic & Life Assistant
              </h2>
              <span className="text-[10px] text-slate-400 block">
                Scoped strictly to your authorized academic database & uploaded vault notes
              </span>
            </div>
          </div>

          {/* Voice Controls */}
          {isSpeaking && (
            <button
              onClick={() => handleSpeak('')}
              className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center space-x-1"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>Stop Speaking</span>
            </button>
          )}
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-1">
                How can I assist your studies today?
              </h3>
              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                I can explain concepts, search your timetable schedule, summarize your notes, track attendance requirements, and analyze exam marks.
              </p>

              {/* Quick Questions */}
              <div className="space-y-1.5 w-full">
                {quickPrompts.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInputMessage(q)}
                    className="w-full text-left text-xs text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 p-2.5 rounded-xl transition-all font-medium"
                  >
                    "{q}"
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'bg-slate-50 border border-slate-200 text-slate-800'
                  }`}
                >
                  {/* Demo Indicator */}
                  {msg.is_demo && (
                    <div className="mb-2 inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                      <Info className="w-3 h-3" />
                      <span>LOCAL DEMO RESPONSE (GROUNDED DATA)</span>
                    </div>
                  )}

                  {/* Message Body */}
                  <div className="whitespace-pre-wrap">{msg.content}</div>

                  {/* Grounded Source Citations */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200/60">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                        Cited Database Records & Sources:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.sources.map((s, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center space-x-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700 shadow-2xs"
                          >
                            <FileText className="w-3 h-3 text-brand-600" />
                            <span>{s.title}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Assistant message action bar */}
                {msg.role === 'assistant' && (
                  <div className="flex items-center space-x-2 mt-1 px-1">
                    <button
                      onClick={() => handleSpeak(msg.content)}
                      className="text-[11px] text-slate-400 hover:text-brand-600 flex items-center space-x-1"
                      title="Read aloud with Text-to-Speech"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Speak</span>
                    </button>
                    <span className="text-[10px] text-slate-400">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
              </div>
            ))
          )}

          {sending && (
            <div className="flex items-start space-x-2">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs text-slate-500 flex items-center space-x-2">
                <LoadingSpinner size="sm" label="" />
                <span>Retrieving authorized student context & formulating answer...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center space-x-2">
            {/* Microphone Button */}
            <button
              type="button"
              onClick={toggleListening}
              className={`p-2 rounded-xl transition-all ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-brand-600 hover:bg-slate-100'
              }`}
              title={isListening ? 'Stop listening' : 'Speak to AI'}
            >
              {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            {/* Text Input */}
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask anything about your timetable, upcoming exams, attendance, or notes..."
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-brand-500 shadow-inner"
            />

            {/* Submit Button */}
            <button
              type="submit"
              disabled={!inputMessage.trim() || sending}
              className="p-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50 transition-all shadow-sm shadow-brand-600/30"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
