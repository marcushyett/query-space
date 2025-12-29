import { describe, it, expect, beforeEach } from 'vitest'
import { useConnectionStore } from '../connectionStore'

describe('connectionStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useConnectionStore.setState({
      connectionString: null,
      organizationId: null,
    })
  })

  describe('initial state', () => {
    it('should have null connection string initially', () => {
      const state = useConnectionStore.getState()
      expect(state.connectionString).toBeNull()
    })

    it('should have null organizationId initially', () => {
      const state = useConnectionStore.getState()
      expect(state.organizationId).toBeNull()
    })

    it('should report not connected initially', () => {
      const state = useConnectionStore.getState()
      expect(state.isConnected()).toBe(false)
    })
  })

  describe('setConnectionString', () => {
    it('should set connection string', () => {
      const connString = 'postgresql://user:pass@localhost:5432/db'
      useConnectionStore.getState().setConnectionString(connString)

      const state = useConnectionStore.getState()
      expect(state.connectionString).toBe(connString)
    })

    it('should update connection string when called again', () => {
      useConnectionStore.getState().setConnectionString('postgresql://localhost/db1')
      useConnectionStore.getState().setConnectionString('postgresql://localhost/db2')

      const state = useConnectionStore.getState()
      expect(state.connectionString).toBe('postgresql://localhost/db2')
    })
  })

  describe('setOrganizationId', () => {
    it('should set organizationId', () => {
      useConnectionStore.getState().setOrganizationId('org-123')

      const state = useConnectionStore.getState()
      expect(state.organizationId).toBe('org-123')
    })

    it('should report connected after setting organizationId', () => {
      useConnectionStore.getState().setOrganizationId('org-123')

      const state = useConnectionStore.getState()
      expect(state.isConnected()).toBe(true)
    })
  })

  describe('clearConnection', () => {
    it('should clear connection string and organizationId', () => {
      useConnectionStore.getState().setConnectionString('postgresql://localhost/db')
      useConnectionStore.getState().setOrganizationId('org-123')
      useConnectionStore.getState().clearConnection()

      const state = useConnectionStore.getState()
      expect(state.connectionString).toBeNull()
      expect(state.organizationId).toBeNull()
    })

    it('should report not connected after clearing', () => {
      useConnectionStore.getState().setOrganizationId('org-123')
      useConnectionStore.getState().clearConnection()

      const state = useConnectionStore.getState()
      expect(state.isConnected()).toBe(false)
    })
  })

  describe('isConnected', () => {
    it('should return false when organizationId is null', () => {
      useConnectionStore.setState({ organizationId: null })
      expect(useConnectionStore.getState().isConnected()).toBe(false)
    })

    it('should return true when organizationId is set', () => {
      useConnectionStore.setState({ organizationId: 'org-123' })
      expect(useConnectionStore.getState().isConnected()).toBe(true)
    })

    it('should return false when only connectionString is set (deprecated behavior)', () => {
      // Note: isConnected now checks organizationId, not connectionString
      useConnectionStore.setState({ connectionString: 'postgresql://localhost/db', organizationId: null })
      expect(useConnectionStore.getState().isConnected()).toBe(false)
    })
  })
})
