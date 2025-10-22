import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPaperPlane, FaLock, FaUserSecret, FaComments, FaExclamationTriangle, FaSync } from 'react-icons/fa';
import { supabase } from '../../supabaseClient';
import '../CSS/chat.css';
import badWordsList from "../badWords.json";

function Chat() {
  const location = useLocation();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [secret, setSecret] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [canSendMessages, setCanSendMessages] = useState(true);

  // Configuração das bad words
  const badwords = {
    listofBadWords: badWordsList.listOfBadWords || []
  };

  // Padrões para dados sensíveis
  const padroes = {
    telefones: /(\+\d{1,3}\s?)?(\(\d{2}\)\s?)?\d{4,5}[-\s]?\d{4}/g,
    emails: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    enderecos: /(\d{1,5}\s[a-zA-Z0-9\s,.]+,\s[a-zA-Z\s]+,\s[a-zA-Z\s]+,\s[a-zA-Z\s]+)/g,
    cpfs: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
    cnpjs: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g
  };

  // Função para sanitizar texto
  const sanitizarTexto = (texto) => {
    if (!texto) return '';
    
    // Verifica se já foi sanitizado
    if (texto.includes('[*]') || texto.includes('*'.repeat(5))) {
      return texto;
    }

    let textoSanitizado = texto;

    // Aplica as substituições para dados sensíveis primeiro
    textoSanitizado = textoSanitizado
      .replace(padroes.telefones, '[*]')
      .replace(padroes.emails, '[*]')
      .replace(padroes.enderecos, '[*]')
      .replace(padroes.cpfs, '[*]')
      .replace(padroes.cnpjs, '[*]');

    // Verifica se há palavras para filtrar
    if (!badwords.listofBadWords || badwords.listofBadWords.length === 0) {
      return textoSanitizado;
    }
    
    // Ordena as palavras por length (mais longas primeiro) para evitar substituições parciais
    const palavrasOrdenadas = [...badwords.listofBadWords].sort((a, b) => b.length - a.length);
    const regexPalavroes = new RegExp(`\\b(${palavrasOrdenadas.join('|')})\\b`, 'gi');
    
    textoSanitizado = textoSanitizado.replace(regexPalavroes, (match) => {
      return '*'.repeat(match.length);
    });
    
    return textoSanitizado;
  };

  // Função para sanitizar mensagens antes de enviar/exibir
  const sanitizarMensagem = (mensagem) => {
    return sanitizarTexto(mensagem);
  };

  // Carregar segredo da navigation state
  useEffect(() => {
    if (location.state?.secret) {
      const secretData = location.state.secret;
      setSecret(secretData);
    }
  }, [location.state]);

  // Carregar conversa quando secret mudar
  useEffect(() => {
    if (secret) {
      loadConversation();
    }
  }, [secret]);

  // Função para verificar o banco de dados (debug)
  const checkDatabase = async () => {
    try {
      if (!conversationId || conversationId === 'null' || conversationId === 'undefined') {
        return;
      }

      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Erro ao verificar banco:', error);
        return;
      }
      
    } catch (error) {
      console.error('Erro ao verificar banco:', error);
    }
  };

  // Função para carregar conversa
  const loadConversation = async () => {
    if (!secret) {
      return;
    }
    
    setLoading(true);
    setError(null);

    try {      
      // Buscar TODAS as comentários para este segredo
      const { data: existingConversations, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('secret_text', secret.text)
        .order('created_at', { ascending: false })
        .limit(1);

      if (convError) {
        console.error('Erro ao buscar comentários:', convError);
        throw convError;
      }

      let conversation = existingConversations?.[0];

      // Se não encontrou conversa, criar uma nova
      if (!conversation) {        
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert([{
            secret_text: secret.text
          }])
          .select()
          .single();

        if (createError) {
          console.error('Erro ao criar conversa:', createError);
          throw createError;
        }

        conversation = newConversation;
      }

      setConversationId(conversation.id);

      // Carregar TODAS as mensagens da conversa
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Erro ao carregar mensagens:', messagesError);
        throw messagesError;
      }
      
      setMessages(messagesData || []);
      
      setUsingFallback(false); 
      
      // Configurar real-time após carregar as mensagens
      setupRealtimeSubscription();

    } catch (error) {
      console.error('Erro ao carregar do Supabase:', error);
      setError('Erro ao carregar conversa: ' + error.message);
      loadFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  // Configurar subscription real-time
  const setupRealtimeSubscription = useCallback(() => {
    if (!conversationId || usingFallback) {
      return;
    }

    try {      
      const subscription = supabase
        .channel(`conversation:${conversationId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        }, (payload) => {
          // Adicionar um novo comentário
          setMessages(prev => [...prev, payload.new]);
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error('Erro ao configurar real-time:', error);
    }
  }, [conversationId, usingFallback]);

  // Fallback para localStorage - SÓ DEVE SER CHAMADO EM CASO DE ERRO
  const loadFromLocalStorage = () => {
    if (!secret) return;
    
    setUsingFallback(true);
    const chatKey = `chat-${secret.text}`;
    const savedMessages = localStorage.getItem(chatKey);
    
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages.messages || []);
        
        setError('Usando armazenamento local (Supabase indisponível)');
        
      } catch (error) {
        console.error('Erro no fallback localStorage:', error);
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  };

  // Rolagem automática para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Enviar mensagem
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !secret || !canSendMessages) {
      return;
    }
    
    // Sanitiza a mensagem antes de enviar
    const mensagemSanitizada = sanitizarMensagem(newMessage.trim());
    
    if (usingFallback) {
      sendMessageFallback(mensagemSanitizada);
      return;
    }
    
    try {
      // Verificar se conversationId é válido
      if (!conversationId || conversationId === 'null' || conversationId === 'undefined') {
        throw new Error('ID da conversa inválido. Recarregue a página.');
      }
      
      // Enviar para Supabase com mensagem sanitizada
      const { data: message, error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          text: mensagemSanitizada
        }])
        .select()
        .single();

      if (error) {
        console.error('Erro ao enviar mensagem:', error);
        throw error;
      }

      setNewMessage('');
      setMessages(prev => [...prev, message]);

      // Backup no localStorage (apenas como backup, não como modo principal)
      const chatKey = `chat-${secret.text}`;
      const existingData = localStorage.getItem(chatKey);
      const currentData = existingData ? JSON.parse(existingData) : { messages: [] };
      
      localStorage.setItem(chatKey, JSON.stringify({
        messages: [...currentData.messages, message],
        count: currentData.count,
        secret: secret
      }));

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setError(error.message);
      // Só usar fallback se realmente houver um erro de conexão
      if (error.message.includes('network') || error.message.includes('fetch') || error.message.includes('offline')) {
        sendMessageFallback(mensagemSanitizada);
      }
    }
  };

  // Enviar mensagem (fallback) - SÓ EM CASO DE ERRO REAL
  const sendMessageFallback = (mensagemSanitizada) => {
    const message = {
      id: Date.now(),
      text: mensagemSanitizada,
      created_at: new Date().toISOString()
    };
    
    const chatKey = `chat-${secret.text}`;
    const existingData = localStorage.getItem(chatKey);
    const currentData = existingData ? JSON.parse(existingData) : { messages: []};
    
    const updatedData = {
      messages: [...currentData.messages, message],
      count: currentData.count,
      secret: secret
    };
    
    localStorage.setItem(chatKey, JSON.stringify(updatedData));
    
    setNewMessage('');
    setMessages(updatedData.messages);
    setUsingFallback(true);
  };

  // Recarregar conversa
  const reloadConversation = () => {
    setLoading(true);
    setUsingFallback(false); 
    loadConversation();
  };

  // Formatar data da mensagem
  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Voltar para a página anterior
  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <button onClick={handleBack} className="back-button">
            <FaArrowLeft />
          </button>
          <h2>Carregando...</h2>
        </div>
        <div className="loading-messages">
          <p>Carregando comentários...</p>
        </div>
      </div>
    );
  }

  if (!secret) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <button onClick={handleBack} className="back-button">
            <FaArrowLeft />
          </button>
          <h2>Nenhuma conversa</h2>
        </div>
        <div className="no-chats">
          <FaComments className="chats-icon" />
          <p>Ainda não há nenhum comentário</p>
          <small>Volte aos segredos para enviar uma mensagem</small>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {error && (
        <div className="error-banner">
          <FaExclamationTriangle /> {error}
          <button onClick={reloadConversation} className="reload-button">
            <FaSync /> Recarregar
          </button>
          <button onClick={checkDatabase} className="reload-button" style={{ marginLeft: '0.5rem' }}>
            Verificar BD
          </button>
        </div>
      )}
      
      {usingFallback && (
        <div className="fallback-indicator">
          <FaExclamationTriangle /> Modo offline - usando armazenamento local
        </div>
      )}

      <div className="chat-header">
        <button onClick={handleBack} className="back-button">
          <FaArrowLeft />
        </button>
        
        <div className="chat-selection">
          <div className="chat-secret-info">
            <FaUserSecret className="secret-icon" />
            <div className="secret-preview">
              {secret?.text && secret.text.length > 50
                ? `${secret.text.substring(0, 50)}...` 
                : secret?.text || "Conversa anônima"
              }
            </div>
          </div>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="no-messages">
            <FaLock className="lock-icon" />
            <p>Nenhum comentário ainda</p>
            <small>
             Seja o primeiro a comentar sobre este segredo
            </small>
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              className="message other-message"
            >
              <div className="message-sender">
                User
              </div>
              <div className="message-content">
                <p>{message.text}</p>
                <span className="message-time">
                  {formatMessageTime(message.created_at || message.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {canSendMessages ? (
        <form onSubmit={handleSendMessage} className="chat-input-form">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite seu Comentário..."
            maxLength={200}
            className="chat-input"
          />
          <button 
            type="submit" 
            disabled={!newMessage.trim()}
            className="send-button"
            title="Enviar mensagem"
          >
            <FaPaperPlane />
          </button>
        </form>
      ) : (
        <div className="message-limit-reached">
          <FaLock className="lock-icon" />
        </div>
      )}
    </div>
  );
}

export default Chat;