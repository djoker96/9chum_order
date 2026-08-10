CREATE OR REPLACE FUNCTION pg_temp.table_signature(
  table_name text,
  order_column text
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  result jsonb;
BEGIN
  IF to_regclass(format('public.%I', table_name)) IS NULL THEN
    RETURN jsonb_build_object('present', false, 'count', 0, 'hash', md5(''));
  END IF;

  EXECUTE format(
    'SELECT jsonb_build_object(''present'', true, ''count'', COUNT(*), ''hash'', md5(COALESCE(string_agg(md5(to_jsonb(row_value)::text), '''' ORDER BY %I::text), ''''))) FROM public.%I AS row_value',
    order_column,
    table_name
  ) INTO result;

  RETURN result;
END;
$$;

SELECT jsonb_build_object(
  'users', pg_temp.table_signature('users', 'id'),
  'sessions', pg_temp.table_signature('sessions', 'id'),
  'products', pg_temp.table_signature('products', 'id'),
  'invoices', pg_temp.table_signature('invoices', 'id'),
  'invoiceItems', pg_temp.table_signature('invoice_items', 'id'),
  'syncLogs', pg_temp.table_signature('product_sync_logs', 'id'),
  'googleSheetConfigs', pg_temp.table_signature('google_sheet_configs', 'id'),
  'invoiceNumberSequences', pg_temp.table_signature('invoice_number_sequences', 'date_key')
)::text;
