'use client'

import { Sparkles, Info, Crown, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import type { SearchIntent, PremiumSearchIntent } from '@/lib/api'

interface AIExplanationBannerProps {
  intent: SearchIntent
  isPremium: boolean
  processingTimeMs?: number
}

export function AIExplanationBanner({ intent, isPremium, processingTimeMs }: AIExplanationBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  
  if (dismissed) return null
  
  const premiumIntent = intent.premiumIntent
  const hasExplanation = isPremium && premiumIntent?.explanation
  
  // For FREE users, show basic purpose detection
  if (!isPremium) {
    if (!intent.purposeDetected && intent.confidence < 0.5) return null
    
    return (
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex-shrink-0">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                AI Search Analysis
              </span>
              <span className="text-xs text-blue-700 dark:text-blue-300 opacity-70">
                (Basic)
              </span>
            </div>
            
            <p className="text-sm text-blue-800 dark:text-blue-200">
              {intent.purposeDetected && (
                <>Detected purpose: <strong>{intent.purposeDetected}</strong>. </>
              )}
              {intent.calibers?.length && (
                <>Searching {intent.calibers.join(', ')}. </>
              )}
              {intent.grainWeights?.length && (
                <>Recommended weights: {intent.grainWeights.join('/')}&nbsp;gr. </>
              )}
            </p>
            
            {/* Upgrade hint */}
            <div className="mt-3 flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" />
              <span className="text-xs text-blue-700 dark:text-blue-300">
                Upgrade to Premium for AI-powered recommendations based on your specific needs
              </span>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-blue-700 hover:text-blue-900 dark:text-blue-300"
            onClick={() => setDismissed(true)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )
  }
  
  // Premium explanation
  if (!hasExplanation) return null
  
  return (
    <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 dark:from-amber-900/20 dark:via-orange-900/20 dark:to-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
      <div className="flex items-start gap-3">
        <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex-shrink-0">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Premium AI Analysis
            </span>
            <Crown className="h-3.5 w-3.5 text-amber-600" />
            {processingTimeMs && (
              <span className="text-xs text-amber-600 dark:text-amber-400 opacity-70">
                {processingTimeMs}ms
              </span>
            )}
          </div>
          
          <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
            {premiumIntent.explanation}
          </p>
          
          {/* Reasoning details */}
          {premiumIntent.reasoning && Object.keys(premiumIntent.reasoning).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {premiumIntent.environment && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200">
                  <Info className="h-3 w-3" />
                  {premiumIntent.environment === 'indoor' ? 'Indoor use' : 
                   premiumIntent.environment === 'outdoor' ? 'Outdoor use' : 'Indoor/Outdoor'}
                </span>
              )}
              
              {premiumIntent.barrelLength && (
                <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200">
                  {premiumIntent.barrelLength === 'short' ? 'Short barrel' :
                   premiumIntent.barrelLength === 'long' ? 'Long barrel' : 'Standard barrel'}
                </span>
              )}
              
              {premiumIntent.suppressorUse && (
                <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200">
                  Suppressor use
                </span>
              )}
              
              {premiumIntent.safetyConstraints?.map(constraint => (
                <span 
                  key={constraint}
                  className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-800/50 text-amber-800 dark:text-amber-200"
                >
                  {constraint.replace(/-/g, ' ')}
                </span>
              ))}
              
              {premiumIntent.priorityFocus && (
                <span className="inline-flex items-center text-xs px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-800/50 text-orange-800 dark:text-orange-200">
                  Priority: {premiumIntent.priorityFocus}
                </span>
              )}
            </div>
          )}
          
          {/* Preferred bullet types */}
          {premiumIntent.preferredBulletTypes && premiumIntent.preferredBulletTypes.length > 0 && (
            <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              <span className="opacity-70">Recommended types: </span>
              <span className="font-medium">{premiumIntent.preferredBulletTypes.join(', ')}</span>
            </div>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-amber-700 hover:text-amber-900 dark:text-amber-300"
          onClick={() => setDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
