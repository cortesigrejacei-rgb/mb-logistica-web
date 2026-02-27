
CREATE OR REPLACE FUNCTION get_daily_dash_stats(query_date date DEFAULT CURRENT_DATE)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_techs INT;
  online_techs INT;
  collections_today INT;
  pending_collections INT;
  total_stock INT;
  critical_stock INT;
  result json;
BEGIN
  -- Total technicians
  SELECT count(*) INTO total_techs FROM technicians;
  
  -- Online or in route technicians
  SELECT count(*) INTO online_techs FROM technicians WHERE status IN ('Online', 'Em Rota');
  
  -- Collections for the day
  SELECT count(*) INTO collections_today FROM collections WHERE "date" = query_date::text;
  
  -- Pending collections
  SELECT count(*) INTO pending_collections FROM collections WHERE status = 'Pendente';
  
  -- Total Stock
  SELECT count(*) INTO total_stock FROM stock_items;
  
  -- Critical Stock (less than 5)
  SELECT count(*) INTO critical_stock FROM stock_items WHERE status = 'Novo';

  result := json_build_object(
    'totalTechs', total_techs,
    'onlineTechs', online_techs,
    'collectionsToday', collections_today,
    'pendingCollections', pending_collections,
    'stockCount', total_stock,
    'stockCritical', critical_stock < 5
  );

  RETURN result;
END;
$$;
