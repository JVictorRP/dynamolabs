"use client";
import { useEffect, useRef, useTransition } from "react";

type State = { ok: boolean } | null;

/**
 * Envio de formulário sem o reset automático do React 19: em erro, o que a pessoa digitou continua.
 * Com `resetOnSuccess`, limpa só quando deu certo.
 */
export function useKeepValues(dispatch: (fd: FormData) => void, state: State, resetOnSuccess = false) {
  const ref = useRef<HTMLFormElement>(null);
  const [, start] = useTransition();
  useEffect(() => {
    if (resetOnSuccess && state?.ok) ref.current?.reset();
  }, [state, resetOnSuccess]);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    start(() => dispatch(fd));
  };
  return { formRef: ref, onSubmit };
}
