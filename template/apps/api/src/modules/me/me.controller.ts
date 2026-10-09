import { Controller, Get } from "@nestjs/common"
import { type AuthSession, CurrentSession } from "../../common"

/** GET /api/me — who am I? A tiny example of reading the session. */
@Controller("me")
export class MeController {
  @Get()
  me(@CurrentSession() session: AuthSession) {
    return {
      user: session.user,
      session: { id: session.session.id, expiresAt: session.session.expiresAt },
    }
  }
}
