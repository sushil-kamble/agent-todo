import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/backlogs')({
  beforeLoad: () => {
    throw redirect({ to: '/' })
  },
})
