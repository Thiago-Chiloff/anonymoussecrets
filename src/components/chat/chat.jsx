import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPaperPlane, FaLock, FaUserSecret, FaComments, FaExclamationTriangle, FaSync, FaBell } from 'react-icons/fa';
import { supabase } from '../../supabaseClient';
import '../CSS/chat.css';

function Chat() {
  const location = useLocation();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [secret, setSecret] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(true);
  const [conversationId, setConversationId] = useState(null);
  const [canSendMessages, setCanSendMessages] = useState(true);

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
      console.log('Iniciando carga da conversa...');
      loadConversation();
    }
  }, [secret]);

  // Função para verificar o banco de dados (debug)
  const checkDatabase = async () => {
    try {
      if (!conversationId || conversationId === 'null' || conversationId === 'undefined') {
        console.log('Conversation ID não é válido:', conversationId);
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

      console.log('Mensagens no banco de dados:', messages || []);
      
    } catch (error) {
      console.error('Erro ao verificar banco:', error);
    }
  };

  // Função para carregar conversa
  const loadConversation = async () => {
    if (!secret) {
      console.log('Condições não atendidas para carregar conversa');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      console.log('Buscando conversa existente para segredo:', secret.text);
      
      // Buscar TODAS as conversas para este segredo
      const { data: existingConversations, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('secret_text', secret.text)
        .order('created_at', { ascending: false })
        .limit(1);

      if (convError) {
        console.error('Erro ao buscar conversas:', convError);
        throw convError;
      }

      let conversation = existingConversations?.[0];

      // Se não encontrou conversa, criar uma nova
      if (!conversation) {
        console.log('Nenhuma conversa existente, criando nova...');
        
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

      console.log('Conversa carregada com sucesso. Total de mensagens:', messagesData?.length || 0);

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
      console.log('Não configurando real-time ' , 'usingFallback:', usingFallback);
      return;
    }

    try {
      console.log('Configurando real-time para conversation:', conversationId);
      
      const subscription = supabase
        .channel(`conversation:${conversationId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        }, (payload) => {
          console.log('Nova mensagem recebida via real-time:', payload.new);
          
          // Adicionar a nova mensagem
          setMessages(prev => [...prev, payload.new]);
          
          // Incrementar o contador para mensagens recebidas
          showNotification(payload.new.text);
          console.log('Nova mensagem - incrementando contador');
        })
        .subscribe();

      console.log('Subscription real-time configurada com sucesso');

      return () => {
        console.log('Desinscrevendo do real-time');
        subscription.unsubscribe();
      };
    } catch (error) {
      console.error('Erro ao configurar real-time:', error);
    }
  }, [conversationId, usingFallback]);

  // Mostrar notificação
  const showNotification = (messageText) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Nova mensagem recebida', {
        body: messageText.length > 50 ? `${messageText.substring(0, 50)}...` : messageText,
        icon: '/favicon.ico',
        tag: 'new-message'
      });
    }
  };

  // Solicitar permissão para notificações
  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('Permissão para notificações concedida');
        }
      });
    }
  };

  // Fallback para localStorage
  const loadFromLocalStorage = () => {
    if (!secret) return;
    
    console.log('Usando fallback localStorage');
    setUsingFallback(true);
    const chatKey = `chat-${secret.text}`;
    const savedMessages = localStorage.getItem(chatKey);
    
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages.messages || []);
        
        // Contar mensagens recebidas
        const receivedMessages = parsedMessages.messages || [];
        
        setError('Usando armazenamento local (Supabase indisponível)');
        
        console.log('Dados carregados do localStorage:', {
          totalMessages: parsedMessages.messages.length
        });
      } catch (error) {
        console.error('Erro no fallback localStorage:', error);
        setMessages([]);
      }
    } else {
      console.log('Nenhum dado encontrado no localStorage');
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
      console.log('Condições não atendidas para enviar mensagem:', {
        hasMessage: !!newMessage.trim(),
        hasSecret: !!secret,
        canSendMessages: canSendMessages
      });
      return;
    }
    
    if (usingFallback) {
      console.log('Usando fallback para enviar mensagem');
      sendMessageFallback();
      return;
    }
    
    try {
      // Verificar se conversationId é válido
      if (!conversationId || conversationId === 'null' || conversationId === 'undefined') {
        throw new Error('ID da conversa inválido. Recarregue a página.');
      }
      
      // Enviar para Supabase
      const { data: message, error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          text: newMessage.trim()
        }])
        .select()
        .single();

      if (error) {
        console.error('Erro ao enviar mensagem:', error);
        throw error;
      }

      setNewMessage('');
      setMessages(prev => [...prev, message]);

      // Backup no localStorage
      const chatKey = `chat-${secret.text}`;
      const existingData = localStorage.getItem(chatKey);
      const currentData = existingData ? JSON.parse(existingData) : { messages: [] };
      
      localStorage.setItem(chatKey, JSON.stringify({
        messages: [...currentData.messages, message],
        count: currentData.count,
        secret: secret
      }));

      console.log('Mensagem enviada com sucesso');

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setError(error.message);
      sendMessageFallback();
    }
  };

  // Enviar mensagem (fallback)
  const sendMessageFallback = () => {
    console.log('Enviando mensagem via fallback');
    const message = {
      id: Date.now(),
      text: newMessage.trim(),
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
    console.log('Recarregando conversa...');
    setLoading(true);
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

  // Permitir notificações
  const enableNotifications = () => {
    requestNotificationPermission();
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
          <p>Carregando conversa...</p>
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
          <p>Você ainda não iniciou conversas</p>
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
              {secret?.text && secret.text.length > 30 
                ? `${secret.text.substring(0, 30)}...` 
                : secret?.text || "Conversa anônima"
              }
            </div>
          </div>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={enableNotifications}
            className="notification-button"
            title="Ativar notificações"
          >
            <FaBell />
          </button>
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="no-messages">
            <FaLock className="lock-icon" />
            <p>Nenhuma mensagem ainda</p>
            <small>
              Máximo de 3 mensagens recebidas por segredo
            </small>
            <br />
            <small>
              O autor do segredo receberá suas mensagens
            </small>
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              className="message other-message"
            >
              <div className="message-sender">
                Usuário
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
            placeholder="Digite sua mensagem..."
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