'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Plus, Trash2, Crosshair, Pencil, Camera, X, ImageIcon, MoreVertical, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  CALIBERS,
  CaliberValue,
  Gun,
  getGunLocker,
  addGun,
  removeGun,
  updateGun,
  uploadGunImage,
  deleteGunImage,
  // Ammo preferences
  AmmoUseCase,
  AmmoPreference,
  AmmoPreferenceGroup,
  AMMO_USE_CASE_ORDER,
  AMMO_USE_CASE_LABELS,
  getFirearmAmmoPreferences,
  removeAmmoPreference,
  updateAmmoPreferenceUseCase,
} from '@/lib/api'
import { refreshSessionToken, showSessionExpiredToast } from '@/hooks/use-session-refresh'
import { safeLogger } from '@/lib/safe-logger'
import { Package, ExternalLink, ChevronDown } from 'lucide-react'
import { AmmoPickerModal } from './ammo-picker-modal'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

// Max dimensions for image resize
const MAX_IMAGE_SIZE = 800
// Target file size in bytes (200KB)
const TARGET_FILE_SIZE = 200 * 1024

/**
 * Compress and resize an image file to a data URL
 */
async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img
      if (width > height) {
        if (width > MAX_IMAGE_SIZE) {
          height = (height * MAX_IMAGE_SIZE) / width
          width = MAX_IMAGE_SIZE
        }
      } else {
        if (height > MAX_IMAGE_SIZE) {
          width = (width * MAX_IMAGE_SIZE) / height
          height = MAX_IMAGE_SIZE
        }
      }

      canvas.width = width
      canvas.height = height
      ctx?.drawImage(img, 0, 0, width, height)

      // Try different quality levels to hit target size
      let quality = 0.8
      let dataUrl = canvas.toDataURL('image/webp', quality)

      // Reduce quality if too large
      while (dataUrl.length > TARGET_FILE_SIZE * 1.37 && quality > 0.1) {
        quality -= 0.1
        dataUrl = canvas.toDataURL('image/webp', quality)
      }

      // Fall back to JPEG if WebP not supported or still too large
      if (dataUrl.length > TARGET_FILE_SIZE * 1.37) {
        quality = 0.7
        dataUrl = canvas.toDataURL('image/jpeg', quality)
        while (dataUrl.length > TARGET_FILE_SIZE * 1.37 && quality > 0.1) {
          quality -= 0.1
          dataUrl = canvas.toDataURL('image/jpeg', quality)
        }
      }

      resolve(dataUrl)
    }

    img.onerror = () => reject(new Error('Failed to load image'))

    // Load the image
    const reader = new FileReader()
    reader.onload = (e) => {
      img.src = e.target?.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function GunLockerManager() {
  const { data: session, status } = useSession()
  const [guns, setGuns] = useState<Gun[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newGun, setNewGun] = useState<{ caliber: CaliberValue | ''; nickname: string }>({
    caliber: '',
    nickname: '',
  })
  const [editingGun, setEditingGun] = useState<Gun | null>(null)
  const [editNickname, setEditNickname] = useState('')
  const [viewingImage, setViewingImage] = useState<Gun | null>(null)
  const [uploadingGunId, setUploadingGunId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Firearm detail view state
  const [selectedGun, setSelectedGun] = useState<Gun | null>(null)
  const [ammoPreferences, setAmmoPreferences] = useState<AmmoPreferenceGroup[]>([])
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false)

  // Ammo picker modal state
  const [isAmmoPickerOpen, setIsAmmoPickerOpen] = useState(false)

  // Extract token from session (properly typed in next-auth.d.ts)
  const token = session?.accessToken

  // Fetch guns on mount
  useEffect(() => {
    if (status === 'loading') return

    const fetchGuns = async () => {
      // Get token, trying to refresh if missing
      let authToken: string | undefined = token
      if (!authToken) {
        // Try to refresh the session to get a new token
        const refreshed = await refreshSessionToken()
        if (!refreshed) {
          // No token available - user needs to sign in
          setIsLoading(false)
          return
        }
        authToken = refreshed
      }

      try {
        const data = await getGunLocker(authToken)
        setGuns(data.guns || [])
      } catch (error) {
        safeLogger.dashboard.error('Failed to fetch guns', {}, error)
        toast.error('Failed to load your guns')
      } finally {
        setIsLoading(false)
      }
    }

    fetchGuns()
  }, [token, status])

  const handleAddGun = async () => {
    if (!newGun.caliber) {
      toast.error('Please select a caliber')
      return
    }

    // Get token, trying to refresh if missing
    let authToken: string | undefined = token
    if (!authToken) {
      // Try to refresh the session to get a new token
      const refreshed = await refreshSessionToken()
      if (!refreshed) {
        // Refresh failed - show toast with sign in action
        showSessionExpiredToast()
        return
      }
      authToken = refreshed
    }

    setIsSubmitting(true)
    try {
      const data = await addGun(
        authToken,
        newGun.caliber as CaliberValue,
        newGun.nickname || null
      )
      setGuns((prev) => [...prev, data.gun])
      setNewGun({ caliber: '', nickname: '' })
      setIsAddDialogOpen(false)
      toast.success('Gun added to your locker')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add gun')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteGun = async (gunId: string) => {
    if (!token) return

    // Optimistic update
    const previousGuns = guns
    setGuns((prev) => prev.filter((g) => g.id !== gunId))

    try {
      await removeGun(token, gunId)
      toast.success('Gun removed from your locker')
    } catch (error) {
      // Revert on failure
      setGuns(previousGuns)
      toast.error('Failed to remove gun')
    }
  }

  const handleEditGun = (gun: Gun) => {
    setEditingGun(gun)
    setEditNickname(gun.nickname || '')
  }

  const handleSaveEdit = async () => {
    if (!editingGun || !token) return

    setIsSubmitting(true)
    try {
      const data = await updateGun(token, editingGun.id, {
        nickname: editNickname || null,
      })
      setGuns((prev) =>
        prev.map((g) => (g.id === editingGun.id ? data.gun : g))
      )
      setEditingGun(null)
      toast.success('Gun updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update gun')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleImageUploadClick = (gunId: string) => {
    setUploadingGunId(gunId)
    fileInputRef.current?.click()
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !uploadingGunId || !token) {
      setUploadingGunId(null)
      return
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      setUploadingGunId(null)
      return
    }

    setIsSubmitting(true)
    try {
      const imageDataUrl = await compressImage(file)
      const data = await uploadGunImage(token, uploadingGunId, imageDataUrl)
      setGuns((prev) =>
        prev.map((g) => (g.id === uploadingGunId ? data.gun : g))
      )
      toast.success('Image uploaded')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to upload image')
    } finally {
      setIsSubmitting(false)
      setUploadingGunId(null)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDeleteImage = async (gun: Gun) => {
    if (!token) return

    setIsSubmitting(true)
    try {
      const data = await deleteGunImage(token, gun.id)
      setGuns((prev) =>
        prev.map((g) => (g.id === gun.id ? data.gun : g))
      )
      setViewingImage(null)
      toast.success('Image deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete image')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getCaliberLabel = (value: string) => {
    return CALIBERS.find((c) => c.value === value)?.label || value
  }

  // Firearm detail handlers
  const handleOpenGunDetail = async (gun: Gun) => {
    setSelectedGun(gun)
    setAmmoPreferences([])
    setIsLoadingPreferences(true)

    if (!token) return

    try {
      const data = await getFirearmAmmoPreferences(token, gun.id)
      setAmmoPreferences(data.groups)
    } catch (error) {
      safeLogger.dashboard.error('Failed to fetch ammo preferences', {}, error)
      toast.error('Failed to load ammo preferences')
    } finally {
      setIsLoadingPreferences(false)
    }
  }

  const handleCloseGunDetail = () => {
    setSelectedGun(null)
    setAmmoPreferences([])
  }

  const handleRemoveAmmoPreference = async (preferenceId: string) => {
    if (!token || !selectedGun) return

    try {
      await removeAmmoPreference(token, selectedGun.id, preferenceId)
      // Update local state - remove from groups
      setAmmoPreferences((prev) =>
        prev
          .map((group) => ({
            ...group,
            preferences: group.preferences.filter((p) => p.id !== preferenceId),
          }))
          .filter((group) => group.preferences.length > 0)
      )
      toast.success('Ammo preference removed')
    } catch (error) {
      toast.error('Failed to remove ammo preference')
    }
  }

  const handleChangeUseCase = async (preferenceId: string, newUseCase: AmmoUseCase) => {
    if (!token || !selectedGun) return

    try {
      const { preference } = await updateAmmoPreferenceUseCase(
        token,
        selectedGun.id,
        preferenceId,
        newUseCase
      )

      // Update local state - move preference between groups
      setAmmoPreferences((prev) => {
        // Remove from current group
        let movedPref: AmmoPreference | null = null
        const filtered = prev
          .map((group) => {
            const found = group.preferences.find((p) => p.id === preferenceId)
            if (found) {
              movedPref = { ...found, useCase: newUseCase }
            }
            return {
              ...group,
              preferences: group.preferences.filter((p) => p.id !== preferenceId),
            }
          })
          .filter((group) => group.preferences.length > 0)

        if (!movedPref) return filtered

        // Add to target group or create it
        const targetGroup = filtered.find((g) => g.useCase === newUseCase)
        if (targetGroup) {
          targetGroup.preferences.push(movedPref)
        } else {
          filtered.push({
            useCase: newUseCase,
            preferences: [movedPref],
          })
        }

        // Sort groups by display order
        return filtered.sort(
          (a, b) =>
            AMMO_USE_CASE_ORDER.indexOf(a.useCase) - AMMO_USE_CASE_ORDER.indexOf(b.useCase)
        )
      })

      toast.success(`Changed to ${AMMO_USE_CASE_LABELS[newUseCase]}`)
    } catch (error) {
      toast.error('Failed to change use case')
    }
  }

  // Compute existing SKU IDs for the ammo picker's "already added" state
  const existingAmmoSkuIds = new Set(
    ammoPreferences.flatMap((g) => g.preferences.map((p) => p.ammoSkuId))
  )

  /**
   * Handle a preference added via the in-place ammo picker modal.
   * Inserts into the correct use-case group optimistically.
   */
  const handleAmmoPickerAdd = (preference: AmmoPreference) => {
    setAmmoPreferences((prev) => {
      const targetGroup = prev.find((g) => g.useCase === preference.useCase)
      if (targetGroup) {
        return prev.map((g) =>
          g.useCase === preference.useCase
            ? { ...g, preferences: [...g.preferences, preference] }
            : g
        )
      }
      // Create new group
      const updated = [...prev, { useCase: preference.useCase, preferences: [preference] }]
      return updated.sort(
        (a, b) =>
          AMMO_USE_CASE_ORDER.indexOf(a.useCase) - AMMO_USE_CASE_ORDER.indexOf(b.useCase)
      )
    })
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-muted animate-pulse rounded-lg" />
        <div className="h-24 bg-muted animate-pulse rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Hidden file input for image uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Add Gun Button - only show when user has guns (empty state has its own CTA) */}
      {guns.length > 0 && (
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Gun
        </Button>
      )}

      {/* Add Gun Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a Gun</DialogTitle>
            <DialogDescription>
              Tell us what calibers you use to personalize your results.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="caliber">Caliber *</Label>
              <Select
                value={newGun.caliber}
                onValueChange={(value: CaliberValue) =>
                  setNewGun((prev) => ({ ...prev, caliber: value }))
                }
              >
                <SelectTrigger id="caliber">
                  <SelectValue placeholder="Select caliber" />
                </SelectTrigger>
                <SelectContent>
                  {CALIBERS.map((caliber) => (
                    <SelectItem key={caliber.value} value={caliber.value}>
                      {caliber.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname">Nickname (optional)</Label>
              <Input
                id="nickname"
                placeholder="e.g., EDC, Range toy, Home defense"
                value={newGun.nickname}
                onChange={(e) =>
                  setNewGun((prev) => ({ ...prev, nickname: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAddGun} disabled={isSubmitting || !newGun.caliber}>
              {isSubmitting ? 'Adding...' : 'Add Gun'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Gun Dialog */}
      <Dialog open={!!editingGun} onOpenChange={(open) => !open && setEditingGun(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Gun</DialogTitle>
            <DialogDescription>
              {editingGun && `Update nickname for your ${getCaliberLabel(editingGun.caliber)}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-nickname">Nickname (optional)</Label>
              <Input
                id="edit-nickname"
                placeholder="e.g., EDC, Range toy, Home defense"
                value={editNickname}
                onChange={(e) => setEditNickname(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditingGun(null)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image View Dialog */}
      <Dialog open={!!viewingImage} onOpenChange={(open) => !open && setViewingImage(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {viewingImage && (viewingImage.nickname || getCaliberLabel(viewingImage.caliber))}
            </DialogTitle>
          </DialogHeader>
          {viewingImage?.imageUrl && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- User-uploaded image */}
              <img
                src={viewingImage.imageUrl}
                alt={viewingImage.nickname || viewingImage.caliber}
                className="w-full rounded-lg"
              />
            </div>
          )}
          <DialogFooter className="flex-row justify-between sm:justify-between">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => viewingImage && handleDeleteImage(viewingImage)}
              disabled={isSubmitting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Image
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => viewingImage && handleImageUploadClick(viewingImage.id)}
              disabled={isSubmitting}
            >
              <Camera className="h-4 w-4 mr-2" />
              Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Firearm Detail Dialog with Ammo Preferences */}
      <Dialog open={!!selectedGun} onOpenChange={(open) => !open && handleCloseGunDetail()}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto overflow-x-hidden">
          {selectedGun && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedGun.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- User-uploaded image
                    <img
                      src={selectedGun.imageUrl}
                      alt={selectedGun.nickname || selectedGun.caliber}
                      className="h-12 w-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                      <Crosshair className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <div>{selectedGun.nickname || getCaliberLabel(selectedGun.caliber)}</div>
                    {selectedGun.nickname && (
                      <div className="text-sm font-normal text-muted-foreground">
                        {getCaliberLabel(selectedGun.caliber)}
                      </div>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>

              {/* Preferred Ammo Section */}
              <div className="space-y-4 py-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">Preferred Ammo</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAmmoPickerOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Ammo
                  </Button>
                </div>

                {isLoadingPreferences ? (
                  <div className="space-y-3">
                    <div className="h-16 bg-muted animate-pulse rounded-lg" />
                    <div className="h-16 bg-muted animate-pulse rounded-lg" />
                  </div>
                ) : ammoPreferences.length === 0 ? (
                  <button
                    onClick={() => setIsAmmoPickerOpen(true)}
                    className="w-full text-center py-8 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm font-medium mb-1">No ammo preferences yet</p>
                    <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                      Tap to search and add ammo you typically shoot with this firearm.
                    </p>
                  </button>
                ) : (
                  <div className="space-y-4">
                    {ammoPreferences.map((group) => (
                      <div key={group.useCase}>
                        <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                          {AMMO_USE_CASE_LABELS[group.useCase]}
                        </h4>
                        <div className="space-y-2">
                          {group.preferences.map((pref) => (
                            <div
                              key={pref.id}
                              className="p-3 rounded-lg border bg-card space-y-2"
                            >
                              <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">
                                    {pref.ammoSku.name}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {[
                                      pref.ammoSku.brand,
                                      pref.ammoSku.grainWeight && `${pref.ammoSku.grainWeight}gr`,
                                      pref.ammoSku.roundCount && `${pref.ammoSku.roundCount}rd`,
                                    ]
                                      .filter(Boolean)
                                      .join(' • ')}
                                  </p>
                                </div>
                                {/* Use case selector */}
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-8 px-2 shrink-0">
                                      <ChevronDown className="h-4 w-4" />
                                    </Button>
                                  </PopoverTrigger>
                                <PopoverContent align="end" className="w-40 p-1">
                                  <div className="space-y-1">
                                    <p className="px-2 py-1 text-xs text-muted-foreground">
                                      Change to:
                                    </p>
                                    {AMMO_USE_CASE_ORDER.filter(
                                      (uc) => uc !== pref.useCase
                                    ).map((useCase) => (
                                      <button
                                        key={useCase}
                                        onClick={() => handleChangeUseCase(pref.id, useCase)}
                                        className="w-full px-2 py-1.5 text-sm text-left rounded hover:bg-muted"
                                      >
                                        {AMMO_USE_CASE_LABELS[useCase]}
                                      </button>
                                    ))}
                                    <hr className="my-1" />
                                    <button
                                      onClick={() => handleRemoveAmmoPreference(pref.id)}
                                      className="w-full px-2 py-1.5 text-sm text-left rounded text-destructive hover:bg-destructive/10"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 inline mr-1.5" />
                                      Remove
                                    </button>
                                  </div>
                                </PopoverContent>
                                </Popover>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => {
                                  // Navigate to search/compare for this product
                                  window.location.href = `/search?q=${encodeURIComponent(pref.ammoSku.name)}`
                                }}
                              >
                                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                                Compare prices
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Ammo Picker Modal — layered on top of firearm detail dialog */}
      {selectedGun && token && (
        <AmmoPickerModal
          open={isAmmoPickerOpen}
          onOpenChange={setIsAmmoPickerOpen}
          firearmId={selectedGun.id}
          firearmLabel={selectedGun.nickname || getCaliberLabel(selectedGun.caliber)}
          caliber={selectedGun.caliber}
          token={token}
          existingSkuIds={existingAmmoSkuIds}
          onPreferenceAdded={handleAmmoPickerAdd}
        />
      )}

      {/* Gun List */}
      {guns.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Crosshair className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No guns added yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Add the guns you shoot to see relevant listings first. Your data stays private
              and you can remove guns at any time.
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Gun
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {guns.map((gun) => (
            <Card key={gun.id} className="relative overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  {/* Image or placeholder */}
                  <button
                    onClick={() => gun.imageUrl ? setViewingImage(gun) : handleImageUploadClick(gun.id)}
                    className="relative flex-shrink-0 h-20 w-20 rounded-lg overflow-hidden bg-muted hover:opacity-80 transition-opacity"
                    disabled={isSubmitting && uploadingGunId === gun.id}
                  >
                    {gun.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- User-uploaded image
                      <img
                        src={gun.imageUrl}
                        alt={gun.nickname || gun.caliber}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center text-muted-foreground">
                        {isSubmitting && uploadingGunId === gun.id ? (
                          <div className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <>
                            <Camera className="h-6 w-6 mb-1" />
                            <span className="text-xs">Add Photo</span>
                          </>
                        )}
                      </div>
                    )}
                  </button>

                  {/* Gun info - clickable to open detail */}
                  <button
                    onClick={() => handleOpenGunDetail(gun)}
                    className="flex-1 min-w-0 text-left hover:opacity-70 transition-opacity"
                  >
                    <p className="font-semibold text-base">{getCaliberLabel(gun.caliber)}</p>
                    {gun.nickname && (
                      <p className="text-sm text-muted-foreground mt-0.5">{gun.nickname}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">View ammo preferences →</p>
                  </button>

                  {/* Action menu — always visible for touch accessibility */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <MoreVertical className="h-4 w-4" />
                        <span className="sr-only">Gun actions</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-36 p-1">
                      <button
                        onClick={() => handleEditGun(gun)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded hover:bg-muted"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteGun(gun.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-left rounded text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </PopoverContent>
                  </Popover>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Privacy Note */}
      <p className="text-xs text-muted-foreground">
        Your Gun Locker is private. This information is only used to personalize results
        ordering and is never shared. You can remove guns at any time.
      </p>
    </div>
  )
}

