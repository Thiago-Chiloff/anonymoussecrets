import { useState, useEffect } from 'react';
import { FaUserSecret, FaCalendarAlt, FaQuoteLeft, FaRocketchat } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import './CSS/Secrets.css';
import badWors from './badWords.json'; 

// Verifica apenas as palavras proibidas sem os espaços entre elas
const badwords = {
  listofBadWords: badWors.listOfBadWords || []
};

// Função para censurar IPs
const censorIP = (ip) => {
  if (!ip || typeof ip !== 'string') return '***.***.***.***';
  return '*'.repeat(Math.min(ip.length, 10));
};

function Secrets({ secrets }) {
  const navigate = useNavigate();
  const [userIP, setUserIP] = useState('');

  // Obter IP do usuário atual
  useEffect(() => {
    const getIP = async () => {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        setUserIP(data.ip);
        console.log('IP do usuário detectado:', censorIP(data.ip)); // CENSURADO
      } catch (error) {
        console.error('Erro ao obter IP:', error);
        // Fallback para um ID único se não conseguir o IP
        const fallbackIP = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        setUserIP(fallbackIP);
        console.log('Usando IP fallback:', censorIP(fallbackIP)); // CENSURADO
      }
    };
    getIP();
  }, []);

  // Função para formatar a data
  const formatDate = (dateString) => {
    const options = { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit',
    };
    return new Date(dateString).toLocaleDateString('pt-BR', options);
  };

  const handleClickChat = async (secret) => {
    // Verificar se já temos o IP do usuário
    let currentUserIP = userIP;
    
    // Se ainda não temos o IP, tentar obter agora
    if (!currentUserIP) {
      try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        currentUserIP = data.ip;
        setUserIP(data.ip);
      } catch (error) {
        console.error('Erro ao obter IP:', error);
        currentUserIP = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        setUserIP(currentUserIP);
      }
    }

    // CORREÇÃO: Incluir o IP do autor no segredo
    const secretWithIP = {
      ...secret,
      // Usar author_ip se existir, caso contrário usar creator_ip como fallback
      author_ip: secret.author_ip || secret.creator_ip || 'unknown'
    };

    console.log('Navegando para chat com:', {
      secret: {
        ...secretWithIP,
        author_ip: censorIP(secretWithIP.author_ip) // CENSURADO
      },
      userIP: censorIP(currentUserIP), // CENSURADO
      authorIP: censorIP(secretWithIP.author_ip) // CENSURADO
    });

    navigate('/chat', { 
      state: { 
        secret: secretWithIP,
        // Incluir o IP do usuário atual também se necessário
        currentUserIP: currentUserIP
      } 
    });
  };

  // Função para sanitizar texto (mesmo se já foi sanitizado antes)
  const sanitizarTexto = (texto) => {
    // Verifica se já foi sanitizado
    if (texto.includes('[*]') || texto.includes('*'.repeat(5))) {
      return texto;
    }

    // Padrões para detectar dados sensíveis
    const padroes = {
      telefones: /(\+\d{1,3}\s?)?(\(\d{2}\)\s?)?\d{4,5}[-\s]?\d{4}/g,
      emails: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      enderecos: /(\d{1,5}\s[a-zA-Z0-9\s,.]+,\s[a-zA-Z\s]+,\s[a-zA-Z\s]+,\s[a-zA-Z\s]+)/g,
      cpfs: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
      cnpjs: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g
    };

    let textoSanitizado = texto;
    
    // Aplica as substituições para dados sensíveis primeiro
    textoSanitizado = textoSanitizado
      .replace(padroes.telefones, '[*]')
      .replace(padroes.emails, '[*]')
      .replace(padroes.enderecos, '[*]')
      .replace(padroes.cpfs, '[*]')
      .replace(padroes.cnpjs, '[*]');
    
    // Ordena as palavras por length (mais longas primeiro) para evitar substituições parciais
    const palavrasOrdenadas = [...badwords.listofBadWords].sort((a, b) => b.length - a.length);
    const regexPalavroes = new RegExp(`\\b(${palavrasOrdenadas.join('|')})\\b`, 'gi');
    
    textoSanitizado = textoSanitizado.replace(regexPalavroes, (match) => {
      return '*'.repeat(match.length);
    });
    
    return textoSanitizado;
  };

  return (
    <div className="secrets-container">
      <div className="secrets-header">
        <h2><FaUserSecret className="header-icon" /> Confissões Anônimas</h2>
        <p className="header-subtitle">Segredos compartilhados pela comunidade</p>
      </div>
      
      {secrets.length === 0 ? (
        <div className="no-secrets">
          <div className="no-secrets-content">
            <FaUserSecret className="no-secrets-icon" />
            <h3>Nenhum segredo ainda</h3>
            <p>Seja o primeiro a compartilhar sua confissão anônima!</p>
          </div>
        </div>
      ) : (
        <div className="secrets-grid">
          {secrets.map((secret) => (
            <div key={secret.id} className="secret-card">
              <div className="secret-card-header">
                <FaQuoteLeft className="quote-icon" />
              </div>
              
              <p className="secret-text">{sanitizarTexto(secret.text)}</p>
              
              <div className="secret-footer">
                <div className="secret-date-container">
                  <FaCalendarAlt className="footer-icon" />
                  <span className="secret-date">
                    {formatDate(secret.created_at)}
                  </span>
                </div>
                {/* Mostrar informações de debug se necessário */}
                {process.env.NODE_ENV === 'development' && secret.author_ip && (
                  <small className="debug-info">
                    IP: {censorIP(secret.author_ip)} {/* CENSURADO */}
                  </small>
                )}
              </div>
              <button 
                onClick={() => handleClickChat(secret)} 
                className="chat-button"
              >
                <FaRocketchat />Envie uma msg para a pessoa
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Secrets;