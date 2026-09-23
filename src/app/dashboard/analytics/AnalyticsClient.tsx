'use client'

import React, { useState } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { AnalyticsPanel } from '@/components/analytics/AnalyticsPanel'
import { InventoryPanel } from '@/components/analytics/InventoryPanel'
import PurchaseAdvisorPanel from '@/components/analytics/PurchaseAdvisorPanel'
import KnowledgeImpactPanel from '@/components/analytics/KnowledgeImpactPanel'

export function AnalyticsClient({
  businessId,
  hasInventory,
}: {
  businessId: string
  hasInventory: boolean
}) {
  const [tab, setTab] = useState('ventas')

  return (
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList>
        <TabsTrigger value="ventas">Ventas</TabsTrigger>
        <TabsTrigger value="impacto">Impacto</TabsTrigger>
        {hasInventory && <TabsTrigger value="inventario">Inventario</TabsTrigger>}
        {hasInventory && <TabsTrigger value="compras">Compras</TabsTrigger>}
      </TabsList>

      <TabsContent value="ventas">
        <AnalyticsPanel businessId={businessId} />
      </TabsContent>

      <TabsContent value="impacto">
        <KnowledgeImpactPanel businessId={businessId} />
      </TabsContent>

      {hasInventory && (
        <TabsContent value="inventario">
          <InventoryPanel businessId={businessId} />
        </TabsContent>
      )}

      {hasInventory && (
        <TabsContent value="compras">
          <PurchaseAdvisorPanel businessId={businessId} />
        </TabsContent>
      )}
    </Tabs>
  )
}
