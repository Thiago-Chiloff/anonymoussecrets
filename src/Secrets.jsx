import { FaUserSecret, FaCalendarAlt, FaQuoteLeft } from 'react-icons/fa';
import './Secrets.css';
import badWors from './badWords.json'; 

const badwords = {
  listofBadWords: badWors.listofBadWords || []
};

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
      emails: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      enderecos: /(\d{1,5}\s[a-zA-Z0-9\s,.]+,\s[a-zA-Z\s]+,\s[a-zA-Z\s]+,\s[a-zA-Z\s]+)/g,
      cpfs: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g,
      cnpjs: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g,
      palavroes: new RegExp(`\\b(${badwords.listofBadWords.join('|')})\\b`, 'gi')
    };

    return texto
      .replace(padroes.telefones, '[*]')
      .replace(padroes.telefones, match => '*'.repeat(match.length))
      .replace(padroes.emails, '[*]')
      .replace(padroes.emails, match => '*'.repeat(match.length))
      .replace(padroes.enderecos, '[*]')
      .replace(padroes.enderecos, match => '*'.repeat(match.length))
      .replace(padroes.cpfs, '[*]')
      .replace(padroes.cpfs, match => '*'.repeat(match.length))
      .replace(padroes.cnpjs, '[*]')
      .replace(padroes.cnpjs, match => '*'.repeat(match.length))
      .replace(padroes.palavroes, match => '*'.repeat(match.length))
      .replace (padroes.palavroes, '[*]');
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