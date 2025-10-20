import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { ThemeProvider, useTheme } from './ThemeContext.jsx';
import Header from './header.jsx';
import Home from './Home.jsx';
import Secrets from './Secrets.jsx';
import WriteSecret from './WriteSecret.jsx';
import Rules from './Rules.jsx';
import Chat from './chat.jsx';
import Messages from './messages.jsx';
import { supabase } from '../supabaseClient.js';
import './CSS/App.css';

// Função para censurar IPs (ocultar partes do IP)
const censorIP = (ip) => {
  if (!ip || typeof ip !== 'string') return '***.***.***.***';
  
  // Se for um IP local/fallback, retorna totalmente censurado
  if (ip.startsWith('local-') || ip.startsWith('user_') || ip === 'unknown') {
    return '***.***.***.***';
  }
  
  // Se for um IP real (IPv4), censura os últimos 2 octetos
  const ipParts = ip.split('.');
  if (ipParts.length === 4) {
    return `${ipParts[0]}.${ipParts[1]}.***.***`;
  }
  
  // Para outros formatos, retorna totalmente censurado
  return '***.***.***.***';
};

// Função para censurar completamente (usar apenas asteriscos)
const censorComplete = (ip) => {
  if (!ip || typeof ip !== 'string') return '*******';
  
  // Se for IP real, retorna asteriscos no mesmo comprimento
  if (ip.includes('.') || ip.includes(':') || ip.length > 7) {
    return '*'.repeat(10); // Comprimento fixo para IPs
  }
  
  return '*'.repeat(Math.min(ip.length, 10));
};

// Componente NotFound corrigido
const NotFoundWrapper = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/'), 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className={`page-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <h2 className="page-heading">404 - Página Não Encontrada</h2>
      <p className="page-content">Redirecionando para a página inicial...</p>
    </div>
  );
};

function App() {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [secrets, setSecrets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('CONNECTING');

  // Função para formatar a data
  const formatSecretDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Função para obter o IP do usuário
  const getUserIP = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      console.log('IP do usuário obtido:', censorIP(data.ip)); // IP CENSURADO NO CONSOLE
      return data.ip;
    } catch (error) {
      console.error('Erro ao obter IP:', error);
      const fallbackIP = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      console.log('Usando IP fallback:', censorComplete(fallbackIP)); // CENSURADO
      return fallbackIP;
    }
  };

  // Busca segredos com tratamento de erro
  const fetchSecrets = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('secrets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Log com IPs censurados
      console.log('Segredos carregados:', data.map(secret => ({
        ...secret,
        author_ip: censorComplete(secret.author_ip) // CENSURADO
      })));

      setSecrets(data.map(secret => ({
        ...secret,
        formattedDate: formatSecretDate(secret.created_at)
      })));
    } catch (err) {
      console.error('Erro ao carregar segredos:', err);
      setError('Falha ao carregar segredos. Tente recarregar a página.');
    } finally {
      setIsLoading(false);
    }
  };

  // Configura o listener em tempo real
  useEffect(() => {
    fetchSecrets();

    const channel = supabase
      .channel('realtime-secrets')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'secrets'
      }, (payload) => {
        // Log com IP censurado
        console.log('Novo segredo em tempo real:', {
          ...payload.new,
          author_ip: censorComplete(payload.new.author_ip) // CENSURADO
        });
        
        setSecrets(prev => [{
          ...payload.new,
          formattedDate: formatSecretDate(payload.new.created_at)
        }, ...prev]);
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'secrets'
      }, (payload) => {
        setSecrets(prev => prev.filter(secret => secret.id !== payload.old.id));
      })
      .on('system', { event: 'DISCONNECTED' }, () => {
        console.log('Conexão com Supabase perdida');
        setConnectionStatus('DISCONNECTED');
      })
      .on('system', { event: 'CONNECTED' }, () => {
        console.log('Conectado ao Supabase');
        setConnectionStatus('CONNECTED');
      })
      .subscribe((status) => {
        console.log('Status da subscription:', status);
      });

    return () => {
      supabase.removeChannel(channel).catch(e => {
        console.error('Erro ao remover channel:', e);
      });
    };
  }, []);

  // Adiciona novo segredo CORRIGIDO - agora com IP
  const addSecret = async (text) => {
    const secretText = text?.text || text;
    if (!secretText?.trim()) {
      setError('Texto do segredo não pode estar vazio');
      return;
    }

    try {
      // Obter o IP do usuário antes de inserir
      const userIP = await getUserIP();
      
      console.log('Criando segredo com IP:', censorComplete(userIP)); // CENSURADO
      
      const { data, error } = await supabase
        .from('secrets')
        .insert([{ 
          text: secretText.trim(),
          author_ip: userIP  // IP REAL (não censurado no banco)
        }])
        .select()
        .single();

      if (error) {
        console.error('Erro do Supabase:', error);
        throw error;
      }
      
      console.log('Segredo criado com sucesso - IP:', censorComplete(data.author_ip)); // CENSURADO
      
      navigate('/secrets');
    } catch (err) {
      console.error('Erro ao adicionar segredo:', err);
      setError('Falha ao publicar segredo. Tente novamente.');
    }
  };

  // Aplica o tema
  useEffect(() => {
    document.documentElement.className = isDarkMode ? 'dark-mode' : 'light-mode';
  }, [isDarkMode]);

  // Limpar erro após 5 segundos
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  if (isLoading) {
    return (
      <div className={`loading ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
        <div className="loading-spinner"></div>
        <p>Carregando segredos...</p>
      </div>
    );
  }

  return (
    <div className={`app ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
      <Header />
      
      {connectionStatus === 'DISCONNECTED' && (
        <div className="connection-banner">
          ⚠️ Conexão instável - tentando reconectar...
        </div>
      )}
      
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}
      
      <main className="main-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route 
            path="/secrets" 
            element={<Secrets secrets={secrets} />} 
          />
          <Route 
            path="/write" 
            element={<WriteSecret addSecret={addSecret} />} 
          />
          <Route path='/messages' element={<Messages />} />
          <Route path='/chat' element={<Chat />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="*" element={<NotFoundWrapper />} />
        </Routes>
      </main>

      {/* Footer opcional */}
      <footer className="app-footer">
        <p>Anonymous Secrets - Compartilhe sem medo</p>
      </footer>
    </div>
  );
}

function AppWrapper() {
  return (
    <ThemeProvider>
      <Router>
        <App />
      </Router>
    </ThemeProvider>
  );
}

export default AppWrapper;