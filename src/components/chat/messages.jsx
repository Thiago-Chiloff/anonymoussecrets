import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaArrowLeft, FaUserSecret, FaComment, FaClock, FaTrash, FaSearch, FaEye, FaEyeSlash, FaExclamationTriangle } from 'react-icons/fa';
import { supabase } from '../../supabaseClient';
import '../CSS/messages.css';

function Messages() {
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [userIP, setUserIP] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Obter IP do usuário atual
  useEffect(() => {
    const getIP = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        setUserIP(data.ip);
      } catch (error) {
        const fallbackIP = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        setUserIP(fallbackIP);
        console.log('Usando IP fallback:', censorIP(fallbackIP));
      }
    };
    getIP();
  }, []);

  // Identificar o usuário atual com base no IP
  useEffect(() => {
    if (userIP) {
      const user = localStorage.getItem('currentUser');
      if (user) {
        const parsedUser = JSON.parse(user);
        if (parsedUser.ip === userIP) {
          setCurrentUser(parsedUser);
        } else {
          createNewUser(userIP);
        }
      } else {
        createNewUser(userIP);
      }
    }
  }, [userIP]);

  const createNewUser = (ip) => {
    const newUser = {
      id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      name: 'Anônimo',
      ip: ip
    };
    localStorage.setItem('currentUser', JSON.stringify(newUser));
    setCurrentUser(newUser);
    console.log('Novo usuário criado com IP:', censorIP(ip));
  };

  // Carregar conversas do usuário atual
  useEffect(() => {
    if (userIP) {
      loadConversations();
      
      // Configurar real-time para atualizar automaticamente
      const subscription = supabase
        .channel('conversations-changes')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'conversations'
        }, (payload) => {
          console.log('Mudança detectada na tabela conversations:', {
            ...payload,
            new: payload.new ? {
              ...payload.new,
              creator_ip: censorIP(payload.new.creator_ip),
              recipient_ip: censorIP(payload.new.recipient_ip)
            } : null,
            old: payload.old ? {
              ...payload.old,
              creator_ip: censorIP(payload.old.creator_ip),
              recipient_ip: censorIP(payload.old.recipient_ip)
            } : null
          });
          loadConversations();
        })
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages'
        }, (payload) => {
          console.log('Mudança detectada na tabela messages:', {
            ...payload,
            new: payload.new ? {
              ...payload.new,
              sender_ip: censorIP(payload.new.sender_ip)
            } : null,
            old: payload.old ? {
              ...payload.old,
              sender_ip: censorIP(payload.old.sender_ip)
            } : null
          });
          loadConversations();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [userIP]);

  // Filtrar conversas baseado no termo de busca
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredConversations(conversations);
    } else {
      const filtered = conversations.filter(conv => 
        conv.secret_text && conv.secret_text.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conv.messages.some(msg => 
          msg.text && msg.text.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
      setFilteredConversations(filtered);
    }
  }, [searchTerm, conversations]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      
      // Carregar apenas conversas do usuário atual
      const { data: conversationsData, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`creator_ip.eq.${userIP},recipient_ip.eq.${userIP}`)
        .order('updated_at', { ascending: false });
      
      if (error) {
        console.error('Erro ao carregar conversas:', error);
        if (error.code === '42501') {
          console.error('ERRO DE PERMISSÃO: Verifique as políticas RLS no Supabase');
          setError('Erro de permissão. Verifique as políticas do banco de dados.');
        }
        return;
      }
      
      // Se não há conversas, mostrar mensagem e retornar
      if (!conversationsData || conversationsData.length === 0) {
        console.log('Nenhuma conversa encontrada para este IP');
        setConversations([]);
        setFilteredConversations([]);
        setLoading(false);
        return;
      }

      // Para cada conversa, carregar as mensagens
      const conversationsWithMessages = await Promise.all(
        conversationsData.map(async (conv) => {
          try {
            const { data: messagesData, error: messagesError } = await supabase
              .from('messages')
              .select('*')
              .eq('conversation_id', conv.id)
              .order('created_at', { ascending: true });
            
            if (messagesError) {
              console.error('Erro ao carregar mensagens da conversa', conv.id, ':', messagesError);
              return {
                id: conv.id,
                secret_text: conv.secret_text,
                creator_ip: conv.creator_ip,
                recipient_ip: conv.recipient_ip,
                messages: [],
                lastMessage: null,
                hasUnreadMessages: false,
                totalMessages: 0,
                otherPeopleMessagesCount: 0,
                error: messagesError.message
              };
            }
            
            // CORREÇÃO: Mostrar TODAS as mensagens, não filtrar por IP
            const lastMessage = messagesData.length > 0 ? messagesData[messagesData.length - 1] : null;
            
            // Verificar se há mensagens não lidas (de outras pessoas)
            const otherPeopleMessages = messagesData.filter(msg => msg.sender_ip !== userIP);
            const unreadMessages = otherPeopleMessages.filter(msg => !msg.read);
            
            return {
              id: conv.id,
              secret_text: conv.secret_text,
              creator_ip: conv.creator_ip,
              recipient_ip: conv.recipient_ip,
              messages: messagesData || [],
              lastMessage: lastMessage,
              hasUnreadMessages: unreadMessages.length > 0,
              totalMessages: messagesData.length,
              otherPeopleMessagesCount: otherPeopleMessages.length,
              unreadCount: unreadMessages.length
            };
          } catch (error) {
            console.error('Erro ao processar conversa', conv.id, ':', error);
            return {
              id: conv.id,
              secret_text: conv.secret_text,
              creator_ip: conv.creator_ip,
              recipient_ip: conv.recipient_ip,
              messages: [],
              lastMessage: null,
              hasUnreadMessages: false,
              totalMessages: 0,
              otherPeopleMessagesCount: 0,
              error: error.message
            };
          }
        })
      );
      setConversations(conversationsWithMessages);
      setFilteredConversations(conversationsWithMessages);
      
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
      setError(error.message);
      setConversations([]);
      setFilteredConversations([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Hoje';
    } else if (diffDays === 1) {
      return 'Ontem';
    } else if (diffDays < 7) {
      return `${diffDays} dias atrás`;
    } else {
      return date.toLocaleDateString('pt-BR');
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const deleteConversation = async (conversationId) => {
    if (window.confirm('Tem certeza que deseja excluir esta conversa?')) {
      try {
        // Primeiro, excluir todas as mensagens da conversa
        const { error: messagesError } = await supabase
          .from('messages')
          .delete()
          .eq('conversation_id', conversationId);
        
        if (messagesError) throw messagesError;
        
        // Depois, excluir a conversa
        const { error: conversationError } = await supabase
          .from('conversations')
          .delete()
          .eq('id', conversationId);
        
        if (conversationError) throw conversationError;
        
        // Recarregar conversas
        loadConversations();
        
        // Se a conversa selecionada foi excluída, limpar a seleção
        if (selectedConversation && selectedConversation.id === conversationId) {
          setSelectedConversation(null);
        }
        
        alert('Conversa excluída com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir conversa:', error);
        alert('Erro ao excluir conversa. Tente novamente.');
      }
    }
  };

  const clearAllConversations = async () => {
    if (window.confirm('Tem certeza que deseja excluir TODAS as suas conversas?')) {
      try {
        // Primeiro, encontrar todas as conversas do usuário
        const { data: userConversations, error: findError } = await supabase
          .from('conversations')
          .select('id')
          .or(`creator_ip.eq.${userIP},recipient_ip.eq.${userIP}`);
        
        if (findError) throw findError;
        
        if (userConversations && userConversations.length > 0) {
          const conversationIds = userConversations.map(conv => conv.id);
          
          // Excluir todas as mensagens das conversas do usuário
          const { error: messagesError } = await supabase
            .from('messages')
            .delete()
            .in('conversation_id', conversationIds);
          
          if (messagesError) throw messagesError;
          
          // Excluir todas as conversas do usuário
          const { error: conversationsError } = await supabase
            .from('conversations')
            .delete()
            .in('id', conversationIds);
          
          if (conversationsError) throw conversationsError;
        }
        
        setConversations([]);
        setFilteredConversations([]);
        setSelectedConversation(null);
        
        alert('Todas as conversas foram excluídas com sucesso!');
      } catch (error) {
        console.error('Erro ao excluir todas as conversas:', error);
        alert('Erro ao excluir conversas. Tente novamente.');
      }
    }
  };

  const navigateToChat = (conversation) => {
    // Determinar o recipientIP corretamente
    const recipientIP = conversation.creator_ip === userIP ? conversation.recipient_ip : conversation.creator_ip;
    
    navigate('/chat', { 
      state: { 
        secret: { 
          text: conversation.secret_text,
          author_ip: conversation.creator_ip,
          creator_ip: conversation.creator_ip
        },
        conversationId: conversation.id,
        recipientIP: recipientIP
      } 
    });
  };

  const getPreviewText = (text, maxLength = 40) => {
    if (!text) return 'Sem texto';
    return text.length > maxLength 
      ? `${text.substring(0, maxLength)}...` 
      : text;
  };

  // Função para determinar se a mensagem é do usuário atual
  const isOwnMessage = (message) => {
    return message.sender_ip === userIP;
  };

  // Função para obter o nome do remetente (consistente com o Chat)
  const getSenderName = (message) => {
    if (isOwnMessage(message)) {
      return 'Você';
    } else {
      return 'Usuário';
    }
  };

  // Função para determinar se o usuário atual é o criador da conversa
  const isConversationCreator = (conversation) => {
    return conversation.creator_ip === userIP;
  };

  // Marcar mensagens como lidas
  const markMessagesAsRead = async (conversationId) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read: true })
        .eq('conversation_id', conversationId)
        .neq('sender_ip', userIP);
      
      if (error) {
        console.error('Erro ao marcar mensagens como lidas:', error);
      } else {
        // Recarregar conversas para atualizar o contador de não lidas
        loadConversations();
      }
    } catch (error) {
      console.error('Erro ao marcar mensagens como lidas:', error);
    }
  };

  // Quando selecionar uma conversa, marcar mensagens como lidas
  useEffect(() => {
    if (selectedConversation) {
      markMessagesAsRead(selectedConversation.id);
    }
  }, [selectedConversation]);

  if (loading) {
    return (
      <div className="messages-container">
        <div className="messages-header">
          <h1>
            <FaComment className="header-icon" />
            Minhas Mensagens
          </h1>
        </div>
        <div className="loading-conversations">
          <p>Carregando conversas...</p>
        </div>
      </div>
    );
  }

  if (selectedConversation) {
    return (
      <div className="messages-container">
        <div className="conversation-header">
          <button 
            onClick={() => setSelectedConversation(null)}
            className="back-button"
          >
            <FaArrowLeft />
          </button>
          <div className="conversation-info">
            <FaUserSecret className="secret-icon" />
            <div className="secret-text-preview">
              {getPreviewText(selectedConversation.secret_text, 50)}
            </div>
            <span className="conversation-role">
              ({isConversationCreator(selectedConversation) ? 'Criador' : 'Participante'})
            </span>
          </div>
          <button 
            onClick={() => deleteConversation(selectedConversation.id)}
            className="delete-button"
            title="Excluir conversa"
          >
            <FaTrash />
          </button>
        </div>

        <div className="conversation-messages">
          {selectedConversation.messages.length === 0 ? (
            <div className="no-messages">
              <FaComment className="message-icon" />
              <p>Nenhuma mensagem nesta conversa</p>
              <small>Seja o primeiro a enviar uma mensagem</small>
            </div>
          ) : (
            selectedConversation.messages.map((message) => (
              <div 
                key={message.id} 
                className={`message ${isOwnMessage(message) ? 'own-message' : 'other-message'} ${message.read ? 'read' : 'unread'}`}
              >
                <div className="message-header">
                  <div className="message-sender">
                    {getSenderName(message)}
                    {!isOwnMessage(message) && !message.read && (
                      <span className="unread-indicator-small" title="Não lida">
                        <FaEyeSlash />
                      </span>
                    )}
                  </div>
                  <span className="message-time">
                    {formatDateTime(message.created_at)}
                  </span>
                </div>
                <div className="message-content">
                  <p>{message.text}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="conversation-actions">
          <button 
            onClick={() => navigateToChat(selectedConversation)}
            className="continue-chat-button"
          >
            <FaComment /> Continuar Conversa
          </button>
          <button 
            onClick={() => deleteConversation(selectedConversation.id)}
            className="delete-conversation-button"
          >
            <FaTrash /> Excluir Conversa
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="messages-container">
      <div className="messages-header">
        <h1>
          <FaComment className="header-icon" />
          Minhas Mensagens
        </h1>
        <div className="header-info">
          <small>IP: {censorIP(userIP)}</small>
          {conversations.some(conv => conv.unreadCount > 0) && (
            <span className="unread-indicator">
              {conversations.reduce((total, conv) => total + (conv.unreadCount || 0), 0)} não lidas
            </span>
          )}
        </div>
        {conversations.length > 0 && (
          <button 
            onClick={clearAllConversations}
            className="clear-all-button"
            title="Excluir todas as conversas"
          >
            <FaTrash /> Limpar Tudo
          </button>
        )}
      </div>

      {error && (
        <div className="error-banner">
          <FaExclamationTriangle /> {error}
          <button onClick={loadConversations} className="reload-button">
            Recarregar
          </button>
        </div>
      )}

      {conversations.length > 0 && (
        <div className="search-container">
          <FaSearch className="search-icon" />
          <input
            type="text"
            placeholder="Buscar em conversas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      )}

      {filteredConversations.length === 0 ? (
        <div className="no-conversations">
          <FaComment className="no-conversations-icon" />
          <h3>Nenhuma conversa encontrada</h3>
          <p>
            {searchTerm ? 'Tente ajustar sua busca' : 'Você ainda não iniciou nenhuma conversa'}
          </p>
          <small>
            {searchTerm 
              ? 'Nenhuma conversa corresponde à sua busca' 
              : 'Volte aos segredos para enviar sua primeira mensagem'
            }
          </small>
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="clear-search-button"
            >
              Limpar busca
            </button>
          )}
          {!searchTerm && (
            <button 
              onClick={() => navigate('/')}
              className="back-to-secrets-button"
            >
              Voltar aos Segredos
            </button>
          )}
        </div>
      ) : (
        <div className="conversations-list">
          {filteredConversations.map((conversation) => (
            <div 
              key={conversation.id} 
              className={`conversation-item ${conversation.hasUnreadMessages ? 'unread' : ''}`}
              onClick={() => setSelectedConversation(conversation)}
            >
              <div className="conversation-preview">
                <FaUserSecret className="conversation-icon" />
                <div className="conversation-details">
                  <div className="secret-preview">
                    {getPreviewText(conversation.secret_text)}
                    {conversation.hasUnreadMessages && (
                      <span className="unread-badge">
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                  {conversation.lastMessage && (
                    <div className="last-message">
                      <span className="sender">
                        {getSenderName(conversation.lastMessage)}: 
                      </span>
                      {getPreviewText(conversation.lastMessage.text, 30)}
                    </div>
                  )}
                  <div className="conversation-stats">
                    <span className="conversation-role-badge">
                      {isConversationCreator(conversation) ? 'Criador' : 'Participante'}
                    </span>
                    <span className="message-stats">
                      {conversation.totalMessages} mensagem{conversation.totalMessages !== 1 ? 's' : ''}
                      {conversation.unreadCount > 0 && ` • ${conversation.unreadCount} não lida${conversation.unreadCount !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="conversation-meta">
                {conversation.lastMessage && (
                  <div className="message-time">
                    <FaClock className="time-icon" />
                    {formatDate(conversation.lastMessage.created_at)}
                  </div>
                )}
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conversation.id);
                  }}
                  className="delete-conversation-small"
                  title="Excluir conversa"
                >
                  <FaTrash />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Messages;