/**
 * Gun Locker Routes
 *
 * Endpoints for managing user's Gun Locker.
 * Per gun_locker_v1_spec.md - calibers are constrained to canonical enum.
 *
 * Routes:
 * - GET    /api/gun-locker           - List all guns
 * - POST   /api/gun-locker           - Add a gun
 * - PATCH  /api/gun-locker/:id       - Update a gun (nickname)
 * - DELETE /api/gun-locker/:id       - Remove a gun
 * - POST   /api/gun-locker/:id/image - Upload/overwrite gun image
 * - DELETE /api/gun-locker/:id/image - Delete gun image
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import {
  getGuns,
  addGun,
  removeGun,
  updateGun,
  countGuns,
  setGunImage,
  deleteGunImage,
  CANONICAL_CALIBERS,
  isValidCaliber,
} from '../services/gun-locker'
import { getAuthenticatedUserId } from '../middleware/auth'
import { invalidateLoadoutCache } from '../services/loadout'
import { loggers } from '../config/logger'
import { getRequestContext } from '@ironscout/logger'

const log = loggers.watchlist // Use watchlist logger for user data operations

const router: Router = Router()

// ============================================================================
// Validation Schemas
// ============================================================================

const addGunSchema = z.object({
  caliber: z.string().refine(isValidCaliber, {
    message: `Invalid caliber. Must be one of: ${CANONICAL_CALIBERS.join(', ')}`,
  }),
  nickname: z.string().max(100).optional().nullable(),
})

const updateGunSchema = z.object({
  nickname: z.string().max(100).optional().nullable(),
})

const imageUploadSchema = z.object({
  imageDataUrl: z.string().min(1, 'Image data is required'),
})

// ============================================================================
// GET /api/gun-locker - List all guns
// ============================================================================

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const guns = await getGuns(userId)

    res.json({
      guns,
      _meta: {
        count: guns.length,
      },
    })
  } catch (error) {
    const err = error as Error
    log.error('Get gun locker error', { message: err.message }, err)
    res.status(500).json({ error: 'Failed to fetch gun locker' })
  }
})

// ============================================================================
// POST /api/gun-locker - Add a gun
// ============================================================================

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const parsed = addGunSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid data',
        details: parsed.error.issues,
      })
    }

    const { caliber, nickname } = parsed.data
    const gun = await addGun(userId, caliber, nickname)
    const count = await countGuns(userId)
    void invalidateLoadoutCache(userId)

    res.status(201).json({
      gun,
      _meta: {
        count,
      },
    })
  } catch (error) {
    const err = error as Error
    log.error('Add gun error', { message: err.message }, err)

    if (err.message.startsWith('Invalid caliber')) {
      return res.status(400).json({
        errorCode: 'INVALID_CALIBER',
        message: 'Invalid caliber specified',
        requestId: getRequestContext()?.requestId,
      })
    }

    res.status(500).json({ error: 'Failed to add gun' })
  }
})

// ============================================================================
// PATCH /api/gun-locker/:id - Update a gun
// ============================================================================

router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const gunId = req.params.id as string

    const parsed = updateGunSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid data',
        details: parsed.error.issues,
      })
    }

    const gun = await updateGun(userId, gunId, parsed.data)
    void invalidateLoadoutCache(userId)

    res.json({ gun })
  } catch (error) {
    const err = error as Error
    log.error('Update gun error', { message: err.message }, err)

    if (err.message === 'Gun not found') {
      return res.status(404).json({ error: 'Gun not found' })
    }

    res.status(500).json({ error: 'Failed to update gun' })
  }
})

// ============================================================================
// DELETE /api/gun-locker/:id - Remove a gun
// ============================================================================

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const gunId = req.params.id as string

    await removeGun(userId, gunId)
    void invalidateLoadoutCache(userId)

    res.json({ message: 'Gun removed', gunId })
  } catch (error) {
    const err = error as Error
    log.error('Remove gun error', { message: err.message }, err)

    if (err.message === 'Gun not found') {
      return res.status(404).json({ error: 'Gun not found' })
    }

    res.status(500).json({ error: 'Failed to remove gun' })
  }
})

// ============================================================================
// POST /api/gun-locker/:id/image - Upload/overwrite gun image
// ============================================================================

router.post('/:id/image', async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const gunId = req.params.id as string

    const parsed = imageUploadSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid data',
        details: parsed.error.issues,
      })
    }

    const gun = await setGunImage(userId, gunId, parsed.data.imageDataUrl)
    void invalidateLoadoutCache(userId)

    res.json({ gun, message: 'Image uploaded' })
  } catch (error) {
    const err = error as Error
    log.error('Upload gun image error', { message: err.message }, err)

    if (err.message === 'Gun not found') {
      return res.status(404).json({ error: 'Gun not found' })
    }

    if (err.message.includes('Invalid image') || err.message.includes('Image too large')) {
      return res.status(400).json({
        errorCode: 'IMAGE_VALIDATION_FAILED',
        message: 'Invalid image format or size',
        requestId: getRequestContext()?.requestId,
      })
    }

    res.status(500).json({ error: 'Failed to upload image' })
  }
})

// ============================================================================
// DELETE /api/gun-locker/:id/image - Delete gun image
// ============================================================================

router.delete('/:id/image', async (req: Request, res: Response) => {
  try {
    const userId = getAuthenticatedUserId(req)
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const gunId = req.params.id as string

    const gun = await deleteGunImage(userId, gunId)
    void invalidateLoadoutCache(userId)

    res.json({ gun, message: 'Image deleted' })
  } catch (error) {
    const err = error as Error
    log.error('Delete gun image error', { message: err.message }, err)

    if (err.message === 'Gun not found') {
      return res.status(404).json({ error: 'Gun not found' })
    }

    res.status(500).json({ error: 'Failed to delete image' })
  }
})

export { router as gunLockerRouter }
