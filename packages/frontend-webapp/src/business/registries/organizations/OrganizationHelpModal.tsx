import React from 'react';
import { useI18n } from '../../../i18n/index.js';

interface OrganizationHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToGeneralHelp?: () => void;
}

export const OrganizationHelpModal: React.FC<OrganizationHelpModalProps> = ({
  isOpen,
  onClose,
  onNavigateToGeneralHelp,
}) => {
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1100,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: 720,
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#f8fafc',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.4rem' }}>📖</span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Guia de Apoio: Organizações, EAS e Salas
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: '#64748b' }}>
                Conformidade regulatória (DATASUS / CNES, ANVISA e CFM)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.2rem',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            overflowY: 'auto',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            fontSize: '0.84rem',
            color: '#334155',
            lineHeight: 1.55,
          }}
        >
          {/* Section 1: Question & Essential Distinction */}
          <div
            style={{
              background: '#f0f9ff',
              border: '1px solid #bae6fd',
              borderRadius: 10,
              padding: '14px 16px',
            }}
          >
            <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0369a1', marginBottom: 6 }}>
              🏢 Por que a Organização e a Unidade Sede são cadastradas separadamente?
            </div>
            <p style={{ margin: '0 0 8px', fontSize: '0.82rem', color: '#0c4a6e' }}>
              No setor de saúde brasileiro, existe uma separação legal estrita entre a <strong>entidade societária/fiscal (Pessoa Jurídica)</strong> e o <strong>estabelecimento físico onde ocorrem os atendimentos (EAS)</strong>:
            </p>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.80rem', color: '#0369a1' }}>
              <li>
                <strong>Organização (Mantenedora):</strong> Titular do CNPJ societário perante a Receita Federal e contratos comerciais. Ela não possui endereço clínico de atendimento nem atende pacientes diretamente.
              </li>
              <li>
                <strong>Unidade (Estabelecimento Assistencial de Saúde - EAS):</strong> Imóvel físico fiscalizado pela Vigilância Sanitária e registrado no <strong>CNES (DATASUS)</strong>, com Responsável Técnico (CRM) vinculado.
              </li>
            </ul>
          </div>

          {/* Section 2: Visual 3-Tier Hierarchy Diagram */}
          <div>
            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
              🌳 Hierarquia em 3 Níveis do OpenClinic
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: 10,
              }}
            >
              {/* Level 1 Card */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '12px 14px',
                  borderTop: '3px solid #0284c7',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span>🏢</span>
                  <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>1. Organização (PJ)</strong>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Razão Social, CNPJ Corporativo, Inscrições e dados societários mantenedores.
                </div>
              </div>

              {/* Level 2 Card */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '12px 14px',
                  borderTop: '3px solid #10b981',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span>⭐/📍</span>
                  <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>2. Unidade (EAS)</strong>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Estabelecimento físico com <strong>Código CNES</strong> oficial. Toda organização possui uma <strong>Sede</strong> e opcionais <strong>Filiais</strong>.
                </div>
              </div>

              {/* Level 3 Card */}
              <div
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  padding: '12px 14px',
                  borderTop: '3px solid #64748b',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span>🚪</span>
                  <strong style={{ fontSize: '0.82rem', color: '#0f172a' }}>3. Sala / Consultório</strong>
                </div>
                <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                  Espaços assistenciais (Consultórios, Procedimentos, Exames) vinculados à agenda de consultas.
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Regulatory Compliance Notes */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: '0.80rem', fontWeight: 700, color: '#475569', marginBottom: 6 }}>
              ⚖️ Por que o CNES é obrigatório em receitas e prontuários?
            </div>
            <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b', lineHeight: 1.5 }}>
              A <strong>Resolução CFM nº 2.299/2021</strong> e a certificação <strong>SBIS</strong> determinam que qualquer documento clínico emitido (receituários de controle especial, atestados, prontuários eletrônicos e faturamento TISS) deve imprimir obrigatoriamente o código CNES do estabelecimento físico onde a consulta aconteceu.
            </p>
          </div>

          {/* Section 4: Auto-provisioning Headquarters */}
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 8,
              padding: '12px 16px',
            }}
          >
            <div style={{ fontSize: '0.80rem', fontWeight: 700, color: '#166534', marginBottom: 4 }}>
              ⚡ Provisionamento Automático da Unidade Sede
            </div>
            <p style={{ margin: 0, fontSize: '0.76rem', color: '#15803d', lineHeight: 1.5 }}>
              Para clínicas e consultórios que operam em endereço único, mantenha marcada a opção <em>"Criar automaticamente a Unidade Sede com os dados cadastrais"</em>. O sistema gerará a Unidade Sede e o primeiro consultório em um único clique, poupando tempo sem ferir a conformidade regulatória.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 22px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 10,
          }}
        >
          {onNavigateToGeneralHelp ? (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToGeneralHelp();
              }}
              style={{
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: 6,
                padding: '6px 12px',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: '#0284c7',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <span>📚</span>
              <span>Acessar Central Geral de Ajuda & Suporte</span>
            </button>
          ) : (
            <div />
          )}

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#0284c7',
              border: 'none',
              borderRadius: 6,
              padding: '7px 16px',
              fontSize: '0.80rem',
              fontWeight: 600,
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            {t('GLOBAL_BTN_CLOSE') || 'Entendi'}
          </button>
        </div>
      </div>
    </div>
  );
};
export default OrganizationHelpModal;
