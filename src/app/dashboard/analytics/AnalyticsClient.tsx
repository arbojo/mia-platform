'use client'

import React, { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AnalyticsPanel } from '@/components/analytics/AnalyticsPanel'
import { InventoryPanel } from '@/components/analytics/InventoryPanel'

export function AnalyticsClient({
  businessId,
  hasInventory,
}: {
  businessId: string
  hasInventory: boolean
}) {
  const [tab, setTab] = useState('ventas')

  if (!hasInventory) {
    return <AnalyticsPanel businessId={businessId} />
  }

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="ventas">Ventas</TabsTrigger>
        <TabsTrigger value="inventario">Inventario</TabsTrigger>
      </TabsList>

      <TabsContent value="ventas">
        <AnalyticsPanel businessId={businessId} />
      </TabsContent>

      <TabsContent value="inventario">
        <InventoryPanel businessId={businessId} />
      </TabsContent>
    </Tabs>
  )
}
