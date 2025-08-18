import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { ThemeProvider, useTheme } from './ThemeContext.jsx';
import Header from './header.jsx';
import Home from './Home.jsx';
import Secrets from './Secrets.jsx';
import WriteSecret from './WriteSecret.jsx';
import Rules from './Rules.jsx';
import './App.css';

// Configuração otimizada do Supabase
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    realtime: {
      reconnect: true,
      heartbeatInterval: 10000
    }
  }
);

// Componente NotFound corrigido
const NotFoundWrapper = () => {
  const navigate = useNavigate();
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const timer = setTimeout(() => navigate('/'), 3000); // Redireciona após 3 segundos
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

  // Busca segredos com tratamento de erro
  const fetchSecrets = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('secrets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

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
        // Atualiza em tempo real sem precisar buscar tudo de novo
        setSecrets(prev => [{
          ...payload.new,
          formattedDate: formatSecretDate(payload.new.created_at)
        }, ...prev]);
      })
      .on('system', { event: 'DISCONNECTED' }, () => {
        setConnectionStatus('DISCONNECTED');
      })
      .on('system', { event: 'CONNECTED' }, () => {
        setConnectionStatus('CONNECTED');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel).catch(e => {
        console.error('Erro ao remover channel:', e);
      });
    };
  }, []);

  // Adiciona novo segredo
  const addSecret = async (text) => {
    const secretText = text?.text || text;
    if (!secretText?.trim()) return;

    try {
      const { error } = await supabase
        .from('secrets')
        .insert([{ text: secretText.trim() }]);

      if (error) throw error;
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
          Conexão instável - tentando reconectar...
        </div>
      )}
      
      {error && (
        <div className="error-banner">
          {error}
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
          <Route path="/rules" element={<Rules />} />
          <Route path="*" element={<NotFoundWrapper />} />
        </Routes>
      </main>
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