-- إصلاح عاجل: نموذج التسجيل يفشل بـ permission denied for function tb_mobile_key
grant execute on function public.tb_mobile_key(text) to anon, authenticated, service_role;
