-- Keep the customer order and production queue on one canonical status.
-- Only mismatched/terminal-active production rows are touched. Manual queue
-- removals and already-correct work orders keep their existing metadata.
UPDATE `work_orders`
SET
  `status` = (
    SELECT `orders`.`order_status`
    FROM `orders`
    WHERE `orders`.`id` = `work_orders`.`order_id`
  ),
  `queue_removed` = CASE
    WHEN (
      SELECT `orders`.`order_status`
      FROM `orders`
      WHERE `orders`.`id` = `work_orders`.`order_id`
    ) IN ('shipped','completed','cancelled') THEN 1
    ELSE `queue_removed`
  END,
  `queue_rank` = CASE
    WHEN (
      SELECT `orders`.`order_status`
      FROM `orders`
      WHERE `orders`.`id` = `work_orders`.`order_id`
    ) IN ('shipped','completed','cancelled') THEN 0
    ELSE `queue_rank`
  END,
  `queue_updated_at` = CURRENT_TIMESTAMP,
  `updated_at` = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1
  FROM `orders`
  WHERE `orders`.`id` = `work_orders`.`order_id`
    AND `orders`.`order_status` IN (
      'work_order_created','waiting_for_production','scheduled','in_production',
      'quality_check','packing','ready_to_ship','shipped','completed','cancelled'
    )
    AND (
      `work_orders`.`status` <> `orders`.`order_status`
      OR (
        `orders`.`order_status` IN ('shipped','completed','cancelled')
        AND `work_orders`.`queue_removed` <> 1
      )
    )
);

PRAGMA optimize;
