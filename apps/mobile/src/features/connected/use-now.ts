import { useEffect, useState } from 'react';

/**
 * Instante atual guardado em estado, para telas que dizem "hoje", "amanhã" ou "há 2 dias". Chamar
 * `Date.now()` direto na renderização dá resultados instáveis; aqui ele muda de propósito, a cada
 * minuto, porque as abas mantêm a tela montada e o texto não pode envelhecer depois da meia-noite.
 */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}
