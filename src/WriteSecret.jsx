import { useState, useRef, useEffect } from 'react';
import { FaLock, FaPaperPlane, FaCheckCircle, FaShieldAlt } from 'react-icons/fa';
import './WriteSecret.css';

function WriteSecret({ addSecret }) {
  const [texto, setTexto] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [caracteresRestantes, setCaracteresRestantes] = useState(1500);
  const [estaFocado, setEstaFocado] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    setCaracteresRestantes(1500 - texto.length);
  }, [texto]);

  // Função adicionada para filtrar dados sensíveis
  const filtrarDadosSensiveis = (texto) => {
    // Falsos positivos comuns
    const palavrasPermitidas = ['que', 'com', 'sem', 'para', 'meu', 'sou', 'uma', 'como'];
    
    // Detecta nomes (2+ palavras com 3+ letras, mesmo minúsculas)
    const regexNomes = /\b([a-zà-ú]{3,})(?:\s+[a-zà-ú]{3,})+\b/g;
    
    // Detecta telefones (com/sem formatação)
    const regexTelefone = /(\d{2}\s?\d{4,5}\s?\d{4})|(\(\d{2}\)\s?\d{4,5}\-?\d{4})/g;
    
    return texto
      .split(/(\s+)/)
      .map(palavra => {
        // Verifica se é um nome próprio
        if (regexNomes.test(palavra.toLowerCase()) && 
            !palavrasPermitidas.includes(palavra.toLowerCase())) {
          return '*'.repeat(palavra.length);
        }
        
        // Verifica se é telefone
        if (regexTelefone.test(palavra)) {
          return '*'.repeat(palavra.length);
        }
        
        return palavra;
      })
      .join('');
  };

  const handleChange = (e) => {
    if (e.target.value.length <= 1500) {
      setTexto(e.target.value);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (texto.trim() && texto.length <= 1500) {
      // Aplica a filtragem antes de enviar
      addSecret(filtrarDadosSensiveis(texto));
      setTexto('');
      setEnviado(true);
      setTimeout(() => setEnviado(false), 3000);
      textareaRef.current.focus();
    }
  };

  /* 
    🔽 TUDO ABAIXO PERMANECE EXATAMENTE IGUAL 🔽
    (não alterei nenhum JSX, textos ou classes)
  */
  return (
    <div className="write-container">
      <div className="write-header">
        <h2><FaLock className="header-icon" /> Compartilhe Seu Segredo</h2>
        <p className="header-subtitle">Este é um espaço seguro - sua identidade nunca será revelada</p>
      </div>
      
      <form onSubmit={handleSubmit} className="secret-form">
        <div className={`input-container ${estaFocado ? 'focused' : ''}`}>
          <textarea
            ref={textareaRef}
            value={texto}
            onChange={handleChange}
            onFocus={() => setEstaFocado(true)}
            onBlur={() => setEstaFocado(false)}
            placeholder="Digite seu segredo mais profundo aqui... ninguém saberá que foi você!"
            className="secret-input"
            required
            rows={8}
            autoFocus
          />
          <div className="input-decoration"></div>
        </div>
        
        <div className="form-footer">
          <div className={`char-counter ${caracteresRestantes < 50 ? 'warning' : ''}`}>
            {caracteresRestantes} / 1500 caracteres restantes
          </div>
          <button 
            type="submit" 
            className="submit-btn"
            disabled={!texto.trim()}
          >
            <FaPaperPlane className="btn-icon" />
            Compartilhar Anonimamente
          </button>
        </div>
      </form>

      {enviado && (
        <div className="success-message">
          <FaCheckCircle className="success-icon" />
          <span>Segredo compartilhado com sucesso! Agora é anônimo para sempre.</span>
        </div>
      )}

      <div className="privacy-note">
        <div className="privacy-header">
          <FaShieldAlt className="privacy-icon" />
          <h3>Sua Privacidade Está Protegida</h3>
        </div>
        <ul>
          <li>Nenhum dado pessoal é coletado ou armazenado</li>
          <li>Sem cookies de rastreamento ou análises</li>
          <li>Segredos são criptografados e armazenados com segurança</li>
          <li>Não há como rastrear até você</li>
        </ul>
      </div>
    </div>
  );
}

export default WriteSecret;