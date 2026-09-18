import { Router } from 'express'
import { getUser, requireAuth } from '../../middleware/auth.js'
import { validateBody } from '../../middleware/validate.js'
import { loginSchema } from './auth.schema.js'
import { getProfile, login } from './auth.service.js'

export const authRouter = Router()

authRouter.post('/login', validateBody(loginSchema), async (req, res) => {
  res.json(await login(req.body))
})

authRouter.get('/me', requireAuth, async (_req, res) => {
  res.json(await getProfile(getUser(res).id))
})
