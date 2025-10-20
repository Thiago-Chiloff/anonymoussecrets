import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaPaperPlane, FaLock, FaUserSecret, FaComments, FaExclamationTriangle, FaSync, FaBell } from 'react-icons/fa';
import { supabase } from '../supabaseClient';
import './CSS/chat.css';

// Funções para censurar IPs
const censorIP = (ip) => {
  if (!ip || typeof ip !== 'string') return '***.***.***.***';
  
  if (ip.startsWith('local-') || ip.startsWith('user_') || ip === 'unknown') {
    return '***.***.***.***';
  }
  
  const ipParts = ip.split('.');
  if (ipParts.length === 4) {
    return `${ipParts[0]}.${ipParts[1]}.***.***`;
  }
  
  return '***.***.***.***';
};

const censorComplete = (ip) => {
  if (!ip || typeof ip !== 'string') return '*******';
  return '*'.repeat(Math.min(ip.length, 10));
};

function Chat() {
  const location = useLocation();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [secret, setSecret] = useState(null);
  const [ipAddress, setIpAddress] = useState('');
  const [messageCount, setMessageCount] = useState(0);
  const [maxMessages] = useState(3);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [isOwnSecret, setIsOwnSecret] = useState(false);
  const [recipientIP, setRecipientIP] = useState('');

  // Obter IP do usuário
  useEffect(() => {
    const fetchIp = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        setIpAddress(data.ip);
        console.log('IP do usuário atual:', censorComplete(data.ip)); // CENSURADO
      } catch (error) {
        console.error('Erro ao obter IP:', error);
        const fallbackIP = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setIpAddress(fallbackIP);
        console.log('Usando IP fallback:', censorComplete(fallbackIP)); // CENSURADO
      }
    };
    
    fetchIp();
  }, []);

  // Carregar segredo da navigation state
  useEffect(() => {
    if (location.state?.secret) {
      const secretData = location.state.secret;
      setSecret(secretData);
      
      console.log('Secret data recebido:', {
        ...secretData,
        author_ip: censorComplete(secretData.author_ip), // CENSURADO
        creator_ip: censorComplete(secretData.creator_ip) // CENSURADO
      });
      
      // CORREÇÃO: Usar author_ip em vez de creator_ip
      const creatorIP = secretData.author_ip || secretData.creator_ip;
      console.log('IP do criador do segredo:', censorComplete(creatorIP)); // CENSURADO
      console.log('IP do usuário atual:', censorComplete(ipAddress)); // CENSURADO
      
      let targetRecipientIP = '';
      
      // CORREÇÃO: Lógica melhorada para determinar o recipientIP
      if (location.state.recipientIP) {
        targetRecipientIP = location.state.recipientIP;
        console.log('Usando recipientIP da navigation state:', censorComplete(targetRecipientIP)); // CENSURADO
      } else if (creatorIP && creatorIP !== ipAddress) {
        targetRecipientIP = creatorIP;
        console.log('Usando IP do criador como recipient:', censorComplete(targetRecipientIP)); // CENSURADO
      } else if (secretData.recipient_ip) {
        targetRecipientIP = secretData.recipient_ip;
        console.log('Usando recipient_ip do segredo:', censorComplete(targetRecipientIP)); // CENSURADO
      } else {
        targetRecipientIP = 'unknown-recipient';
        console.log('Usando recipient fallback:', censorComplete(targetRecipientIP)); // CENSURADO
      }
      
      setRecipientIP(targetRecipientIP);
      
      // CORREÇÃO: Verificação melhorada de "own secret"
      const isOwn = creatorIP === ipAddress && !location.state.recipientIP;
      setIsOwnSecret(isOwn);
      
      if (isOwn) {
        setError('Você não pode enviar mensagens para seu próprio segredo');
        console.log('Usuário tentando enviar mensagem para próprio segredo');
      } else {
        setError(null);
        console.log('Conversa permitida - IPs diferentes');
      }
      
      console.log('isOwnSecret:', isOwn);
    }
  }, [location.state, ipAddress]);

  // Carregar conversa quando secret ou IP mudarem
  useEffect(() => {
    if (secret && ipAddress && recipientIP && !isOwnSecret) {
      console.log('Iniciando carga da conversa...');
      loadConversation();
    } else if (isOwnSecret) {
      setLoading(false);
    }
  }, [secret, ipAddress, recipientIP, isOwnSecret]);

  // Função para tratar erros do Supabase
  const handleSupabaseError = (error, context) => {
    console.error(`Erro no ${context}:`, error);
    
    if (error.code === '406' || error.code === 'PGRST301' || error.code === '42501') {
      return 'PERMISSION_ERROR';
    }
    
    return 'OTHER_ERROR';
  };

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

      console.log('Mensagens no banco de dados:', messages.map(msg => ({
        ...msg,
        sender_ip: censorComplete(msg.sender_ip) // CENSURADO
      })));
      console.log('IP do usuário atual:', censorComplete(ipAddress)); // CENSURADO
      console.log('Mensagens de outras pessoas:', messages.filter(msg => msg.sender_ip !== ipAddress).length);
      
    } catch (error) {
      console.error('Erro ao verificar banco:', error);
    }
  };

  // Função para carregar conversa
  const loadConversation = async () => {
    if (!secret || !ipAddress || !recipientIP || isOwnSecret) {
      console.log('Condições não atendidas para carregar conversa');
      return;
    }
    
    // Verificar se secret.text é válido
    if (!secret.text || secret.text.trim() === '') {
      setError('Texto do segredo inválido');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      console.log('Buscando conversa existente para segredo:', secret.text);
      
      // Buscar conversa existente baseada no texto do segredo e IPs envolvidos
      const { data: existingConversations, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('secret_text', secret.text)
        .or(`creator_ip.eq.${ipAddress},recipient_ip.eq.${ipAddress},creator_ip.eq.${recipientIP},recipient_ip.eq.${recipientIP}`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (convError) {
        const errorType = handleSupabaseError(convError, 'carregar conversa');
        
        if (errorType === 'PERMISSION_ERROR') {
          throw new Error('Sem permissão para acessar conversas. Verifique as políticas RLS.');
        }
        throw convError;
      }

      console.log('Conversas existentes encontradas:', existingConversations?.map(conv => ({
        ...conv,
        creator_ip: censorComplete(conv.creator_ip), // CENSURADO
        recipient_ip: censorComplete(conv.recipient_ip) // CENSURADO
      })));

      let conversation = existingConversations?.[0];

      // Se não encontrou conversa, criar uma nova
      if (!conversation) {
        console.log('Nenhuma conversa existente, criando nova...');
        
        // Garantir que recipient_ip não seja null
        const validRecipientIP = recipientIP || 'unknown-recipient';
        
        const { data: newConversation, error: createError } = await supabase
          .from('conversations')
          .insert([{
            secret_text: secret.text,
            creator_ip: ipAddress,
            recipient_ip: validRecipientIP
          }])
          .select()
          .single();

        if (createError) {
          const createErrorType = handleSupabaseError(createError, 'criar conversa');
          if (createErrorType === 'PERMISSION_ERROR') {
            throw new Error('Sem permissão para criar conversa. Verifique as políticas RLS.');
          }
          throw createError;
        }

        conversation = newConversation;
        console.log('Nova conversa criada - IPs:', {
          creator_ip: censorComplete(conversation.creator_ip), // CENSURADO
          recipient_ip: censorComplete(conversation.recipient_ip) // CENSURADO
        });
      }

      setConversationId(conversation.id);
      console.log('Conversation ID definido:', conversation.id);

      // Carregar mensagens da conversa
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (messagesError) {
        const messagesErrorType = handleSupabaseError(messagesError, 'carregar mensagens');
        if (messagesErrorType === 'PERMISSION_ERROR') {
          throw new Error('Sem permissão para carregar mensagens. Verifique as políticas RLS.');
        }
        throw messagesError;
      }

      console.log('Mensagens carregadas:', messagesData?.map(msg => ({
        ...msg,
        sender_ip: censorComplete(msg.sender_ip) // CENSURADO
      })));

      // CORREÇÃO: Mostrar TODAS as mensagens, não filtrar por IP
      setMessages(messagesData || []);
      
      // Contar apenas mensagens recebidas (de outras pessoas) para o limite
      const receivedMessages = messagesData ? messagesData.filter(msg => msg.sender_ip !== ipAddress) : [];
      setMessageCount(receivedMessages.length);
      
      setUsingFallback(false);
      
      // Configurar real-time após carregar as mensagens
      setupRealtimeSubscription();

      console.log('Conversa carregada com sucesso. Total de mensagens:', messagesData?.length || 0);
      console.log('Mensagens recebidas (para limite):', receivedMessages.length);

    } catch (error) {
      console.error('Erro ao carregar do Supabase:', error);
      setError(error.message);
      // Fallback para localStorage
      loadFromLocalStorage();
    } finally {
      setLoading(false);
    }
  };

  // Configurar subscription real-time
  const setupRealtimeSubscription = useCallback(() => {
    if (!conversationId || usingFallback) {
      console.log('Não configurando real-time - conversationId:', conversationId, 'usingFallback:', usingFallback);
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
          console.log('Nova mensagem recebida via real-time - IP:', censorComplete(payload.new.sender_ip)); // CENSURADO
          
          // CORREÇÃO: Adicionar TODAS as novas mensagens
          setMessages(prev => [...prev, payload.new]);
          
          // Se a mensagem for de outra pessoa, incrementar o contador
          if (payload.new.sender_ip !== ipAddress) {
            setMessageCount(prev => prev + 1);
            showNotification(payload.new.text);
            console.log('Mensagem de outra pessoa - incrementando contador');
          } else {
            console.log('Mensagem própria - não incrementando contador');
          }
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
  }, [conversationId, usingFallback, ipAddress]);

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
    if (!secret || !ipAddress) return;
    
    console.log('Usando fallback localStorage');
    setUsingFallback(true);
    const chatKey = `chat-${secret.text}-${ipAddress}`;
    const savedMessages = localStorage.getItem(chatKey);
    
    if (savedMessages) {
      try {
        const parsedMessages = JSON.parse(savedMessages);
        // CORREÇÃO: Mostrar TODAS as mensagens no fallback também
        setMessages(parsedMessages.messages || []);
        
        // Contar apenas mensagens recebidas
        const receivedMessages = parsedMessages.messages.filter(msg => msg.sender_ip !== ipAddress);
        setMessageCount(receivedMessages.length);
        
        setError('Usando armazenamento local (Supabase indisponível)');
        
        console.log('Dados carregados do localStorage:', {
          totalMessages: parsedMessages.messages.length,
          receivedMessages: receivedMessages.length
        });
      } catch (error) {
        console.error('Erro no fallback localStorage:', error);
        setMessages([]);
        setMessageCount(0);
      }
    } else {
      console.log('Nenhum dado encontrado no localStorage');
      setMessages([]);
      setMessageCount(0);
    }
  };

  // Rolagem automática para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Enviar mensagem
  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || messageCount >= maxMessages || !secret || isOwnSecret) {
      console.log('Condições não atendidas para enviar mensagem:', {
        hasMessage: !!newMessage.trim(),
        underLimit: messageCount < maxMessages,
        hasSecret: !!secret,
        isOwnSecret: isOwnSecret
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

      console.log('Enviando mensagem para conversation:', conversationId);
      
      // Enviar para Supabase
      const { data: message, error } = await supabase
        .from('messages')
        .insert([{
          conversation_id: conversationId,
          text: newMessage.trim(),
          sender_ip: ipAddress,
          sender_name: "Você"
        }])
        .select()
        .single();

      if (error) {
        const errorType = handleSupabaseError(error, 'enviar mensagem');
        if (errorType === 'PERMISSION_ERROR') {
          throw new Error('Sem permissão para enviar mensagem. Verifique as políticas RLS.');
        }
        throw error;
      }

      setNewMessage('');
      // CORREÇÃO: Adicionar a mensagem à lista (já será adicionada via real-time, mas isso garante)
      setMessages(prev => [...prev, message]);

      // Backup no localStorage
      const chatKey = `chat-${secret.text}-${ipAddress}`;
      const existingData = localStorage.getItem(chatKey);
      const currentData = existingData ? JSON.parse(existingData) : { messages: [], count: messageCount };
      
      localStorage.setItem(chatKey, JSON.stringify({
        messages: [...currentData.messages, message],
        count: currentData.count, // Manter o mesmo count (só mensagens recebidas)
        secret: secret
      }));

      console.log('Mensagem enviada com sucesso - IP:', censorComplete(message.sender_ip)); // CENSURADO

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
      created_at: new Date().toISOString(),
      sender_ip: ipAddress,
      sender_name: "Você"
    };
    
    const chatKey = `chat-${secret.text}-${ipAddress}`;
    const existingData = localStorage.getItem(chatKey);
    const currentData = existingData ? JSON.parse(existingData) : { messages: [], count: messageCount };
    
    const updatedData = {
      messages: [...currentData.messages, message],
      count: currentData.count, // Não incrementar contador para suas próprias mensagens
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

  // Função para determinar se a mensagem é do usuário atual
  const isOwnMessage = (message) => {
    return message.sender_ip === ipAddress;
  };

  // Função para obter o nome do remetente
  const getSenderName = (message) => {
    if (isOwnMessage(message)) {
      return 'Você';
    } else {
      return 'Usuário';
    }
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

  if (isOwnSecret) {
    return (
      <div className="chat-container">
        <div className="chat-header">
          <button onClick={handleBack} className="back-button">
            <FaArrowLeft />
          </button>
          <h2>Conversa Bloqueada</h2>
        </div>
        <div className="no-chats">
          <FaLock className="lock-icon" style={{ color: '#ff6b6b', fontSize: '3rem' }} />
          <p>Você não pode enviar mensagens para seu próprio segredo</p>
          <small>Esta medida previne spam e mantém a privacidade</small>
          <button onClick={handleBack} className="back-button" style={{ marginTop: '1rem' }}>
            Voltar aos segredos
          </button>
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
          <div className="message-counter">
            {messageCount}/{maxMessages} mensagens recebidas
          </div>
        </div>
      </div>

      {/* Informações de debug (apenas em desenvolvimento) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="debug-info">
          <small>IP Usuário: {censorComplete(ipAddress)}</small>
          <small>IP Destino: {censorComplete(recipientIP)}</small>
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 ? (
          <div className="no-messages">
            <FaLock className="lock-icon" />
            <p>Nenhuma mensagem ainda</p>
            <small>Máximo de {maxMessages} mensagens recebidas por segredo</small>
            <br />
            <small>O autor do segredo receberá suas mensagens</small>
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              className={`message ${isOwnMessage(message) ? 'own-message' : 'other-message'}`}
            >
              <div className="message-sender">
                {getSenderName(message)}
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

      {messageCount < maxMessages ? (
        <form onSubmit={handleSendMessage} className="chat-input-form">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Digite sua mensagem..."
            maxLength={200}
            className="chat-input"
            disabled={isOwnSecret}
          />
          <button 
            type="submit" 
            disabled={!newMessage.trim() || isOwnSecret}
            className="send-button"
            title={isOwnSecret ? "Não é possível enviar para seu próprio segredo" : "Enviar mensagem"}
          >
            <FaPaperPlane />
          </button>
        </form>
      ) : (
        <div className="message-limit-reached">
          <FaLock className="lock-icon" />
          <p>Limite de mensagens recebidas atingido</p>
          <small>Máximo de {maxMessages} mensagens recebidas por conversa</small>
        </div>
      )}
    </div>
  );
}

export default Chat;