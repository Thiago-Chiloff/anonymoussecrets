import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../CSS/Home.css';
import SecretKeeper from '../assets/Nerd.png'; 

function Home() {
  const navigate = useNavigate();
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  const handleGetStarted = () => {
    navigate('/secrets');
  };

  const handleShareSecret = () => {
    navigate('/write');
  };

  return (
    <div className="home-container">
      <div className="home-content">
        <h1 className="home-title">Anonymous Secrets</h1>
        
        <div className="home-messages">
          <p className="home-text">
            Um lugar seguro para compartilhar seus segredos mais profundos sem julgamentos.
            Totalmente anônimo - ninguém saberá que foi você.
          </p>
          
          {showDisclaimer && (
            <div className="disclaimer-box">
              <p className="disclaimer-text">
                <strong>Aviso importante:</strong> Este não é um lugar para conteúdo ilegal ou prejudicial.
                Todos os segredos são moderados. <br />
                Respeite os outros como gostaria de ser respeitado.
              </p>
              <p className='disclaimer-text'>
                <strong> NÃO ESQUEÇA QUE SEUS SEGREDOS PODEM SER LIDOS POR OUTRAS PESSOAS.</strong>
              </p>
              <p className='disclaimer-text'>
                <strong>OS CHATS PODEM SER LIDOS POR OUTRAS PESSOAS.</strong>
              </p>
              <button 
                className="disclaimer-close"
                onClick={() => setShowDisclaimer(false)}
                aria-label="Fechar aviso"
              >
                &times;
                
              </button>
            </div>

            
          )}
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">🔒</div>
            <h3>Totalmente Anônimo</h3>
            <p>Não armazenamos nenhum dado que possa identificar você.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">👁️</div>
            <h3>Leia Confissões</h3>
            <p>Descubra o que outras pessoas estão guardando.</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">✍️</div>
            <h3>Compartilhe</h3>
            <p>Liberte-se compartilhando o que você precisa confessar.</p>
          </div>
        </div>

        <div className="action-buttons">
          <button 
            className="action-button primary"
            onClick={handleGetStarted}
          >
            Ver Confissões
          </button>
          <button 
            className="action-button secondary"
            onClick={handleShareSecret}
          >
            Compartilhar Segredo
          </button>
        </div>

        <img 
          src={SecretKeeper} 
          alt="Guardião dos Segredos" 
          className="secret-keeper"
        />
      </div>
    </div>
  );
}

export default Home;