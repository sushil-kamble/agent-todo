import { handleSubscriptionRoutes } from '../domains/agents/subscription.routes.mjs'
import { handleProjectRoutes } from '../domains/projects/project.routes.mjs'
import { handleRunRoutes } from '../domains/runs/run.routes.mjs'
import { handleTaskRoutes } from '../domains/tasks/task.routes.mjs'

export const routeHandlers = [
  handleTaskRoutes,
  handleRunRoutes,
  handleSubscriptionRoutes,
  handleProjectRoutes,
]
