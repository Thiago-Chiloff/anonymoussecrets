import { FaUserSecret, FaCalendarAlt, FaQuoteLeft } from 'react-icons/fa';
import './Secrets.css';

function Secrets({ secrets }) {
  // Função para formatar a data
  const formatDate = (dateString) => {
    const options = { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit',
    };
    return new Date(dateString).toLocaleDateString('pt-BR', options);
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
    };

    return texto
      .replace(padroes.telefones, '[NÚMERO BLOQUEADO]')
      .replace(padroes.telefones, match => '*'.repeat(match.length));
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
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Secrets;