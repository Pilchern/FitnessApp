# Application Package

Application services, use cases, commands, queries, and repository ports belong here. This layer coordinates workflows but should not know about Next.js routing or provider payload formats.

Usage pattern:

- parse unknown input at the service boundary with Zod
- hand validated DTOs to repository interfaces
- return canonical domain objects or small DTOs to callers
