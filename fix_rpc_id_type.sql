-- DROP old function with UUID signature (to avoid ambiguity)
DROP FUNCTION IF EXISTS send_push_notification_rpc(UUID, TEXT, TEXT);

-- CREATE new function with TEXT signature
CREATE OR REPLACE FUNCTION send_push_notification_rpc(
  target_id TEXT,
  title TEXT,
  body TEXT
) RETURNS JSON AS $$
DECLARE
  v_token TEXT;
  v_resp_status INTEGER;
  v_resp_body TEXT;
  v_payload TEXT;
BEGIN
  -- Buscar o Token do Técnico
  SELECT expo_push_token INTO v_token 
  FROM technicians 
  WHERE id = target_id;
  
  -- Se não tiver token, retorna erro amigável
  IF v_token IS NULL OR v_token = '' THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'NO_TOKEN_FOUND: Técnico sem token registrado.'
    );
  END IF;

  -- Registrar no histórico (Tabela notifications)
  INSERT INTO notifications (technician_id, title, body, created_at)
  VALUES (target_id, title, body, now());

  -- Preparar o corpo da requisição para Expo
  v_payload := json_build_object(
    'to', v_token,
    'title', title,
    'body', body,
    'sound', 'default',
    'priority', 'high'
  )::text;

  -- Enviar a requisição HTTP (Síncrono)
  SELECT status, content INTO v_resp_status, v_resp_body
  FROM extensions.http((
    'POST',
    'https://exp.host/--/api/v2/push/send',
    ARRAY[extensions.http_header('Content-Type', 'application/json')],
    'application/json',
    v_payload
  )::extensions.http_request);

  -- Verificar Resposta da Expo
  IF v_resp_status = 200 THEN
     RETURN json_build_object(
       'success', true, 
       'data', v_resp_body::json
     );
  ELSE
     RETURN json_build_object(
       'success', false, 
       'error', 'HTTP ' || v_resp_status || ': ' || v_resp_body
     );
  END IF;

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object(
    'success', false, 
    'error', SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grants
GRANT EXECUTE ON FUNCTION send_push_notification_rpc(TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION send_push_notification_rpc(TEXT, TEXT, TEXT) TO anon;
