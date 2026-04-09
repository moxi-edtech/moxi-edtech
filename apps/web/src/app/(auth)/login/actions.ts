type LoginActionState = {
  ok: boolean;
  message: string;
};

export async function loginAction(
  _: LoginActionState,
  _formData: FormData
): Promise<LoginActionState> {
  return { ok: false, message: "DEPRECATED_AUTH_FLOW" };
}
