import { FaExclamationTriangle, FaUserSecret, FaBan, FaHeart } from "react-icons/fa";
import "./Rules.css";

function Rules() {
  return (
    <div className="rules-container">
      <div className="rules-header">
        <h1>Regras da Comunidade</h1>
        <p className="rules-subtitle">Mantenha nossa comunidade segura e acolhedora</p>
      </div>

      <div className="golden-rule">
        <FaExclamationTriangle className="rule-icon warning" />
        <h2>REGRAS DE OURO</h2>
        <p>Este NÃO é um lugar para conteúdo ilegal ou prejudicial!</p>
      </div>

      <div className="rules-grid">
        <div className="rule-card">
          <FaUserSecret className="rule-icon" /> 
          <h3>Respeite o Anonimato</h3>
          <p>Não use nomes reais, deixe da forma mais agrangente o possível</p>
        </div>

        <div className="rule-card">
          <FaBan className="rule-icon" />
          <h3>Sem Discurso de Ódio</h3>
          <p>Discriminação ou assédio de qualquer tipo é proibido</p>
        </div>

        <div className="rule-card">
          <FaExclamationTriangle className="rule-icon" />
          <h3>Sem Conteúdo Nocivo</h3>
          <p>Evite compartilhar material perigoso ou violento</p>
        </div>

        <div className="rule-card">
          <FaHeart className="rule-icon" />
          <h3>Seja Gentil</h3>
          <p>Trate as confissões dos outros com respeito e empatia</p>
        </div>
      </div>

      <div className="consequences">
        <h3>Violar as regras resultará em:</h3>
        <ul>
          <li>Remoção imediata do conteúdo</li>
          <li>Possível banimento do seu ip (se aplicável), sem revogação</li>
          <li>Ações legais para violações graves</li>
        </ul>
      </div>
    </div>
  );
}

export default Rules;