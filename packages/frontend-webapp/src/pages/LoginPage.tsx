import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { forgotPassword, resetPassword } from '../services/api.js';
import { EyeIcon, EyeOffIcon } from '../components/EyeIcons.js';
import { AlertBanner, AlertBannerType } from '../components/AlertBanner.js';
import { Footer } from '../arch/layout/Footer.js';
import { useConfig } from '../context/ConfigContext.js';
import { t, type TranslationKey } from '../i18n/index.js';
import logoImg from '../assets/logo.png';
import { LoginIdentifierType, Cpf, Email, BOOTSTRAP_DEFAULTS } from '@openclinic/core/shared';
import { AuthView, type TestUser } from '../arch/types/auth.js';
export { AuthView, type TestUser } from '../arch/types/auth.js';

/**
 * Canonical validator for login identifier based on the configured login type.
 * Returns null if valid, or the i18n translation key of the validation error.
 */
export function validateLoginIdentifier(identifier: string, type: LoginIdentifierType): TranslationKey | null {
  const trimmed = identifier.trim();
  if (!trimmed) {
    return 'VALIDATION_ERROR_REQUIRED';
  }

  const normType = String(type || '').toUpperCase();

  if (normType === LoginIdentifierType.EMAIL) {
    if (!Email.isValid(trimmed)) {
      return Email.ERROR_CODE;
    }
    return null;
  }

  if (normType === LoginIdentifierType.CPF) {
    if (!Cpf.isValid(trimmed)) {
      return Cpf.ERROR_CODE;
    }
    return null;
  }

  // Fallback for USERNAME: if input consists of 11 digits without letters, validate CPF algorithm
  const cleanDigits = Cpf.clean(trimmed);
  if (cleanDigits.length === 11 && !trimmed.includes('@') && !/[a-zA-Z]/.test(trimmed)) {
    if (!Cpf.isValid(trimmed)) {
      return Cpf.ERROR_CODE;
    }
  }

  return null;
}

export const TEST_USERS: TestUser[] = [
  { username: 'ana.souza', cpf: '444.555.666-19', email: 'ana@clinica.com.br', role: 'Atendente' },
  { username: 'marta.lima', cpf: '333.444.555-08', email: 'marta@clinica.com.br', role: 'Enfermeira' },
  { username: 'mateus.oliveira', cpf: '222.333.444-05', email: 'mateus@clinica.com.br', role: 'Médico' },
  { username: 'marcos.ferreira', cpf: '111.222.333-96', email: 'marcos@clinica.com.br', role: 'Diretor' },
  { username: 'lucas.santos', cpf: '987.654.321-00', email: 'lucas@clinica.com.br', role: 'Administrador' },
  { username: 'joao.silva', cpf: '123.456.789-09', email: 'joao@clinica.com.br', role: 'Superadministrador' },
];

export default function LoginPage() {
  const { appLogoUrl, appName, appSubtitle, appVersion, primaryLoginIdentifier, refreshConfig } = useConfig();
  const [view, setView] = useState<AuthView>(AuthView.LOGIN);

  // Refresh public configuration whenever login page mounts (e.g. after logout or setting change)
  useEffect(() => {
    refreshConfig();
  }, [refreshConfig]);

  const identifierConfig = {
    [LoginIdentifierType.CPF]: {
      label: t('FIELD_LOGIN_IDENTIFIER_CPF'),
      placeholder: '000.000.000-00',
      type: 'text',
    },
    [LoginIdentifierType.USERNAME]: {
      label: t('FIELD_LOGIN_IDENTIFIER_USERNAME'),
      type: 'text',
    },
    [LoginIdentifierType.EMAIL]: {
      label: t('FIELD_LOGIN_IDENTIFIER_EMAIL'),
      type: 'email',
    },
  }[primaryLoginIdentifier] || {
    label: t('FIELD_LOGIN_IDENTIFIER_CPF'),
    placeholder: '000.000.000-00',
    type: 'text',
  };

  // Login State
  const [identifier, setIdentifier] = useState('');
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const { login, error: authError, clearError, isLoading } = useAuth();
  const identifierInputRef = useRef<HTMLInputElement>(null);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const isSelectingTestUserRef = useRef(false);

  // Automatically focus on username / identifier whenever the login form is shown
  useEffect(() => {
    if (view === AuthView.LOGIN) {
      const timer = setTimeout(() => {
        identifierInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [view]);

  // Forgot Password State
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotIdentifierError, setForgotIdentifierError] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotResult, setForgotResult] = useState<{ message: string; data?: { simulated_email?: string; reset_token?: string } } | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // Reset Password State
  const [resetToken, setResetToken] = useState('');
  const [resetTokenError, setResetTokenError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [showResetPass, setShowResetPass] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    clearError();
    if (primaryLoginIdentifier === LoginIdentifierType.CPF) {
      const formatted = Cpf.format(val);
      setIdentifier(formatted);
      if (Cpf.clean(val).length === 11) {
        if (!Cpf.isValid(val)) {
          setIdentifierError(t(Cpf.ERROR_CODE));
        } else {
          setIdentifierError(null);
        }
      } else {
        setIdentifierError(null);
      }
    } else {
      setIdentifier(val);
      setIdentifierError(null);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    setPasswordError(null);
    clearError();
  };

  const handleIdentifierBlur = () => {
    if (isSelectingTestUserRef.current) {
      return;
    }
    const errCode = validateLoginIdentifier(identifier, primaryLoginIdentifier);
    setIdentifierError(errCode ? t(errCode) : null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setIdentifierError(null);
    setPasswordError(null);

    let hasError = false;

    const idErrCode = validateLoginIdentifier(identifier, primaryLoginIdentifier);
    if (idErrCode) {
      setIdentifierError(t(idErrCode));
      hasError = true;
    }

    if (!password) {
      setPasswordError(t('VALIDATION_ERROR_REQUIRED'));
      hasError = true;
    }

    if (hasError) {
      if (idErrCode) {
        identifierInputRef.current?.focus();
      } else {
        passwordInputRef.current?.focus();
      }
      return;
    }

    const success = await login(identifier.trim(), password);
    if (!success) {
      setTimeout(() => {
        passwordInputRef.current?.focus();
        passwordInputRef.current?.select();
      }, 50);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotIdentifierError(null);

    if (!forgotIdentifier.trim()) {
      setForgotIdentifierError(t('VALIDATION_ERROR_REQUIRED'));
      return;
    }

    setForgotLoading(true);
    try {
      const res = await forgotPassword(forgotIdentifier);
      setForgotResult(res);
      if (res.data?.reset_token) {
        setResetToken(res.data.reset_token);
      }
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : t('ERROR_FORGOT_PASSWORD'));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetTokenError(null);
    setNewPasswordError(null);
    setConfirmPasswordError(null);

    let hasError = false;

    if (!resetToken.trim()) {
      setResetTokenError(t('VALIDATION_ERROR_REQUIRED'));
      hasError = true;
    }

    if (!newPassword) {
      setNewPasswordError(t('VALIDATION_ERROR_REQUIRED'));
      hasError = true;
    } else if (newPassword.length < 8) {
      setNewPasswordError(t('PLATFORM_SETTINGS_MIN_PASS_LEN_INVALID'));
      hasError = true;
    }

    if (!confirmPassword) {
      setConfirmPasswordError(t('VALIDATION_ERROR_REQUIRED'));
      hasError = true;
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError(t('ERROR_PASSWORD_MISMATCH'));
      hasError = true;
    }

    if (hasError) return;

    setResetLoading(true);
    try {
      const res = await resetPassword(resetToken, newPassword);
      setResetSuccess(res.message);
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
      setForgotResult(null);
      setView(AuthView.LOGIN);
    } catch (err) {
      setResetError(err instanceof Error ? err.message : t('ERROR_RESET_PASSWORD'));
    } finally {
      setResetLoading(false);
    }
  };

  const handleSelectTestUser = (user: TestUser) => {
    isSelectingTestUserRef.current = true;
    const normType = String(primaryLoginIdentifier || '').toUpperCase();
    let credentialValue = user.username;
    if (normType === LoginIdentifierType.CPF) {
      credentialValue = user.cpf;
    } else if (normType === LoginIdentifierType.EMAIL) {
      credentialValue = user.email;
    } else {
      credentialValue = user.username;
    }

    setIdentifier(credentialValue);
    setPassword(BOOTSTRAP_DEFAULTS.DEFAULT_OWNER_PASSWORD);
    setIdentifierError(null);
    setPasswordError(null);
    clearError();
    identifierInputRef.current?.focus();
    setTimeout(() => {
      isSelectingTestUserRef.current = false;
    }, 200);
  };

  const wrapperStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
    overflowY: 'auto',
    padding: '20px 12px',
    boxSizing: 'border-box',
  };

  const layoutStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'stretch',
    gap: 24,
    maxWidth: 1060,
    width: '100%',
    margin: 'auto',
  };

  const loginCardStyle: React.CSSProperties = {
    flex: '1 1 380px',
    maxWidth: 440,
    minWidth: 310,
    background: '#ffffff',
    borderRadius: 18,
    boxShadow: '0 12px 30px -8px rgba(0, 0, 0, 0.07), 0 8px 12px -6px rgba(0, 0, 0, 0.04)',
    border: '1px solid #e2e8f0',
    padding: '36px 32px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  };

  const sideCardStyle: React.CSSProperties = {
    flex: '1 1 500px',
    maxWidth: 600,
    minWidth: 310,
    background: '#ffffff',
    borderRadius: 18,
    boxShadow: '0 12px 30px -8px rgba(0, 0, 0, 0.07), 0 8px 12px -6px rgba(0, 0, 0, 0.04)',
    border: '1px solid #e2e8f0',
    padding: '28px 22px',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    fontSize: '0.94rem',
    boxSizing: 'border-box',
    outline: 'none',
    color: '#0f172a',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  };

  const getInputStyle = (hasError: boolean): React.CSSProperties => ({
    ...inputStyle,
    borderColor: hasError ? '#ef4444' : '#cbd5e1',
    boxShadow: hasError ? '0 0 0 1px #ef4444' : undefined,
  });

  const renderFieldError = (msg?: string | null) => {
    if (!msg) return null;
    return (
      <span style={{ display: 'block', fontSize: '0.78rem', color: '#ef4444', marginTop: 4, fontWeight: 500 }}>
        ⚠️ {msg}
      </span>
    );
  };

  const btnStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px',
    borderRadius: 8,
    background: '#0ea5e9',
    color: '#ffffff',
    border: 'none',
    fontSize: '0.96rem',
    fontWeight: 600,
    cursor: 'pointer',
  };

  return (
    <div style={wrapperStyle}>
      <div style={layoutStyle}>
        {/* Left Card: Login Form */}
        <div style={loginCardStyle}>
          <div>
            {/* Brand Header */}
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <img
          src={appLogoUrl || logoImg}
          alt={appName || "Logo"}
          style={{ height: 64, objectFit: 'contain', marginBottom: 10 }}
          onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
        />
        <h1 style={{ margin: 0, fontSize: '1.85rem', color: '#0f172a', fontWeight: 800, letterSpacing: '-0.03em' }}>
          {appName}
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: '0.84rem', color: '#64748b', lineHeight: 1.45, fontWeight: 500 }}>
          {view === AuthView.LOGIN && appSubtitle}
          {view === AuthView.FORGOT && t('FORGOT_SUBTITLE')}
          {view === AuthView.RESET && t('RESET_SUBTITLE')}
        </p>
      </div>

      {/* ── 1. TELA DE LOGIN ── */}
      {view === AuthView.LOGIN && (
        <form noValidate onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {resetSuccess && (
            <AlertBanner
              type={AlertBannerType.SUCCESS}
              message={resetSuccess}
              onClose={() => setResetSuccess(null)}
            />
          )}

          <div>
            <label htmlFor="username" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              {identifierConfig.label}
            </label>
            <input
              id="username"
              name="username"
              ref={identifierInputRef}
              type={identifierConfig.type}
              placeholder={identifierConfig.placeholder}
              value={identifier}
              onChange={handleIdentifierChange}
              onBlur={handleIdentifierBlur}
              style={getInputStyle(Boolean(identifierError || authError))}
              autoComplete="username"
              autoFocus
              required
              aria-required="true"
              aria-invalid={Boolean(identifierError || authError)}
            />
            {renderFieldError(identifierError)}
          </div>

          <div>
            <label htmlFor="password" style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              {t('FIELD_LOGIN_PASSWORD')}
            </label>
            
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="password"
                name="password"
                ref={passwordInputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handlePasswordChange}
                style={{ ...getInputStyle(Boolean(passwordError || authError)), paddingRight: 44 }}
                autoComplete="current-password"
                required
                aria-required="true"
                aria-invalid={Boolean(passwordError || authError)}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 12,
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: 0.75,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.75'; }}
                title={showPassword ? t('TOOLTIP_HIDE_PASS') : t('TOOLTIP_SHOW_PASS')}
              >
                {showPassword ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
              </button>
            </div>
            {renderFieldError(passwordError || authError)}

            {/* Forgot password link */}
            <div style={{ textAlign: 'right', marginTop: 6 }}>
              <button
                type="button"
                onClick={() => {
                  setView(AuthView.FORGOT);
                  clearError();
                  setIdentifierError(null);
                  setPasswordError(null);
                }}
                style={{ background: 'transparent', border: 'none', color: '#0284c7', fontSize: '0.80rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
              >
                {t('FORGOT_PASS_LINK')}
              </button>
            </div>
          </div>

          <button type="submit" disabled={isLoading} style={{ ...btnStyle, opacity: isLoading ? 0.7 : 1, marginTop: 4 }}>
            {isLoading ? t('BTN_PROCESSING') : t('LOGIN_BTN')}
          </button>
        </form>
      )}

      {/* ── 2. FORGOT PASSWORD VIEW ── */}
      {view === AuthView.FORGOT && (
        <form noValidate onSubmit={handleForgotSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ textAlign: 'center', marginBottom: 8 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: '0 0 6px 0' }}>
              {t('FORGOT_PASS_LINK')}
            </h2>
            <p style={{ fontSize: '0.84rem', color: '#64748b', margin: 0 }}>
              {t('FORGOT_SUBTITLE')}
            </p>
          </div>

          {!forgotResult && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
                  {t('FIELD_LOGIN_IDENTIFIER')}
                </label>
                <input
                  type="email"
                  value={forgotIdentifier}
                  onChange={(e) => {
                    setForgotIdentifier(e.target.value);
                    setForgotIdentifierError(null);
                    setForgotError(null);
                  }}
                  style={getInputStyle(Boolean(forgotIdentifierError || forgotError))}
                />
                {renderFieldError(forgotIdentifierError || forgotError)}
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                style={{ ...btnStyle, opacity: forgotLoading ? 0.7 : 1, marginTop: 6 }}
              >
                {forgotLoading ? t('BTN_PROCESSING') : t('BTN_SEND_RECOVERY')}
              </button>
            </>
          )}

          {forgotResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ padding: 14, background: '#f0fdf4', color: '#166534', borderRadius: 8, fontSize: '0.84rem', border: '1px solid #bbf7d0', lineHeight: 1.5 }}>
                ✅ <strong>{t('LOGIN_SIMULATION_TITLE')}</strong><br />
                {forgotResult.message}
              </div>

              <button
                type="button"
                onClick={() => setView(AuthView.RESET)}
                style={{ ...btnStyle, background: '#0284c7' }}
              >
                {t('BTN_CONTINUE_RESET')} ➔
              </button>
            </div>
          )}

          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => {
                setView(AuthView.LOGIN);
                clearError();
                setForgotError(null);
                setForgotIdentifierError(null);
              }}
              style={{ padding: '8px', background: 'transparent', color: '#64748b', border: 'none', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
            >
              ← {t('BTN_BACK_TO_LOGIN')}
            </button>
          </div>
        </form>
      )}

      {/* ── 3. RESET PASSWORD VIEW ── */}
      {view === AuthView.RESET && (
        <form noValidate onSubmit={handleResetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {resetSuccess && (
            <AlertBanner
              type={AlertBannerType.SUCCESS}
              message={resetSuccess}
              onClose={() => setResetSuccess(null)}
            />
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              {t('FIELD_RECOVERY_TOKEN')}
            </label>
            <input
              type="text"
              value={resetToken}
              onChange={(e) => {
                setResetToken(e.target.value);
                setResetTokenError(null);
                setResetError(null);
              }}
              style={{ ...getInputStyle(Boolean(resetTokenError)), fontFamily: 'monospace', fontSize: '0.82rem' }}
            />
            {renderFieldError(resetTokenError)}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              {t('FIELD_NEW_PASS_MIN')}
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showResetPass ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setNewPasswordError(null);
                  setResetError(null);
                }}
                style={{ ...getInputStyle(Boolean(newPasswordError || resetError)), paddingRight: 44 }}
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowResetPass(!showResetPass)}
                style={{ position: 'absolute', right: 12, background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
                title={showResetPass ? t('TOOLTIP_HIDE_PASS') : t('TOOLTIP_SHOW_PASS')}
              >
                {showResetPass ? <EyeOffIcon size={20} /> : <EyeIcon size={20} />}
              </button>
            </div>
            {renderFieldError(newPasswordError)}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              {t('FIELD_CONFIRM_PASSWORD')}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setConfirmPasswordError(null);
                setResetError(null);
              }}
              style={getInputStyle(Boolean(confirmPasswordError || resetError))}
            />
            {renderFieldError(confirmPasswordError || resetError)}
          </div>

          <button type="submit" disabled={resetLoading} style={{ ...btnStyle, opacity: resetLoading ? 0.7 : 1 }}>
            {resetLoading ? t('BTN_PROCESSING') : t('BTN_SAVE_NEW_PASSWORD')}
          </button>

          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => {
                setView(AuthView.LOGIN);
                clearError();
                setResetError(null);
                setResetTokenError(null);
                setNewPasswordError(null);
                setConfirmPasswordError(null);
              }}
              style={{ padding: '8px', background: 'transparent', color: '#64748b', border: 'none', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}
            >
              ← {t('BTN_CANCEL_AND_BACK')}
            </button>
          </div>
        </form>
      )}
    </div>

          {/* Card Footer: Version */}
          {appVersion && (
            <div
              style={{
                marginTop: 24,
                paddingTop: 12,
                borderTop: '1px solid #f1f5f9',
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: '0.72rem',
                  color: '#94a3b8',
                  fontWeight: 500,
                  letterSpacing: '0.02em',
                  userSelect: 'none',
                }}
              >
                v{appVersion.replace(/^v/, '')}
              </span>
            </div>
          )}
        </div>

        {/* Right Card: Homologation Notice & Test Users Table */}
        <div style={sideCardStyle}>
          <div>
            {/* Red Notice: Auth Testing Scope Disclaimer */}
            <div
              role="note"
              style={{
                padding: '12px 14px',
                background: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: 10,
                color: '#b91c1c',
                fontSize: '0.78rem',
                lineHeight: 1.5,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                boxShadow: '0 1px 2px rgba(239, 68, 68, 0.05)',
                marginBottom: 16,
              }}
            >
              <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: 1 }}>⚠️</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontWeight: 800, fontSize: '0.84rem' }}>Ambiente de Testes</span>
                <span style={{ fontWeight: 400, color: '#991b1b', lineHeight: 1.5 }}>
                  Esta aplicação é destinada à validação dos recursos de <strong>autenticação e autorização</strong> e de <strong>cadastros básicos</strong> integrados ao backend. Novas funcionalidades serão implementadas conforme a necessidade dos testes.
                </span>
                <span style={{ fontWeight: 400, color: '#991b1b', lineHeight: 1.5 }}>
                  As páginas marcadas como <strong>“Módulo em Construção”</strong> são demonstrativas e utilizadas para validar <strong>acessos e permissões por perfil de usuário</strong>.
                </span>
              </div>
            </div>

            {/* Test Users Table Container */}
            <div style={{
              background: '#f8fafc',
              borderRadius: 10,
              padding: '14px 16px',
              border: '1px solid #cbd5e1',
              boxSizing: 'border-box',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}>
                <span style={{ fontWeight: 700, color: '#334155', fontSize: '0.82rem' }}>
                  Usuários de Teste
                </span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 600,
                  color: '#0369a1',
                  background: '#e0f2fe',
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid #bae6fd',
                }}>
                  {primaryLoginIdentifier}
                </span>
              </div>

              <div>
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.74rem',
                  textAlign: 'left',
                }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', color: '#475569' }}>
                      <th style={{ padding: '7px 6px', fontWeight: 600 }}>Perfil</th>
                      <th style={{ padding: '7px 6px', fontWeight: 600, color: String(primaryLoginIdentifier).toUpperCase() === LoginIdentifierType.USERNAME ? '#0284c7' : '#475569' }}>Username</th>
                      <th style={{ padding: '7px 6px', fontWeight: 600, color: String(primaryLoginIdentifier).toUpperCase() === LoginIdentifierType.CPF ? '#0284c7' : '#475569' }}>CPF</th>
                      <th style={{ padding: '7px 6px', fontWeight: 600, color: String(primaryLoginIdentifier).toUpperCase() === LoginIdentifierType.EMAIL ? '#0284c7' : '#475569' }}>E-mail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TEST_USERS.map((u, index) => {
                      const normLoginType = String(primaryLoginIdentifier).toUpperCase();
                      return (
                        <tr
                          key={u.username}
                          style={{
                            borderBottom: index < TEST_USERS.length - 1 ? '1px solid #f1f5f9' : 'none',
                            transition: 'background-color 0.15s ease',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#f1f5f9'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            isSelectingTestUserRef.current = true;
                          }}
                          onClick={() => handleSelectTestUser(u)}
                        >
                          <td style={{ padding: '7px 6px', whiteSpace: 'nowrap' }}>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                isSelectingTestUserRef.current = true;
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectTestUser(u);
                              }}
                              title="Clique para entrar com este perfil"
                              style={{
                                background: 'none',
                                border: 'none',
                                padding: 0,
                                color: '#0284c7',
                                fontWeight: 600,
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                fontSize: 'inherit',
                                fontFamily: 'inherit',
                                textAlign: 'left',
                              }}
                            >
                              {u.role}
                            </button>
                          </td>
                          <td
                            style={{
                              padding: '7px 6px',
                              fontFamily: 'monospace',
                              color: '#0f172a',
                              whiteSpace: 'nowrap',
                              fontWeight: normLoginType === LoginIdentifierType.USERNAME ? 700 : 400,
                            }}
                          >
                            {u.username}
                          </td>
                          <td
                            style={{
                              padding: '7px 6px',
                              fontFamily: 'monospace',
                              color: '#334155',
                              whiteSpace: 'nowrap',
                              fontWeight: normLoginType === LoginIdentifierType.CPF ? 700 : 400,
                            }}
                          >
                            {u.cpf}
                          </td>
                          <td
                            style={{
                              padding: '7px 6px',
                              fontFamily: 'monospace',
                              color: '#334155',
                              whiteSpace: 'nowrap',
                              fontWeight: normLoginType === LoginIdentifierType.EMAIL ? 700 : 400,
                            }}
                          >
                            {u.email}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <Footer style={{ marginTop: 24 }} />
      </div>
    </div>
  );
}
