import { describe, it, expect, beforeEach } from 'vitest'
import { useConnectionStore } from '../connectionStore'

describe('connectionStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useConnectionStore.setState({
      connectionString: null,
    })
  })

  describe('initial state', () => {
    it('should have null connection string initially', () => {
      const state = useConnectionStore.getState()
      expect(state.connectionString).toBeNull()
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

    it('should report connected after setting connection string', () => {
      useConnectionStore.getState().setConnectionString('postgresql://localhost/db')

      const state = useConnectionStore.getState()
      expect(state.isConnected()).toBe(true)
    })

    it('should update connection string when called again', () => {
      useConnectionStore.getState().setConnectionString('postgresql://localhost/db1')
      useConnectionStore.getState().setConnectionString('postgresql://localhost/db2')

      const state = useConnectionStore.getState()
      expect(state.connectionString).toBe('postgresql://localhost/db2')
    })
  })

  describe('clearConnection', () => {
    it('should clear connection string', () => {
      useConnectionStore.getState().setConnectionString('postgresql://localhost/db')
      useConnectionStore.getState().clearConnection()

      const state = useConnectionStore.getState()
      expect(state.connectionString).toBeNull()
    })

    it('should report not connected after clearing', () => {
      useConnectionStore.getState().setConnectionString('postgresql://localhost/db')
      useConnectionStore.getState().clearConnection()

      const state = useConnectionStore.getState()
      expect(state.isConnected()).toBe(false)
    })
  })

  describe('isConnected', () => {
    it('should return false when connection string is null', () => {
      useConnectionStore.setState({ connectionString: null })
      expect(useConnectionStore.getState().isConnected()).toBe(false)
    })

    it('should return true when connection string is set', () => {
      useConnectionStore.setState({ connectionString: 'postgresql://localhost/db' })
      expect(useConnectionStore.getState().isConnected()).toBe(true)
    })

    it('should return true even for empty string', () => {
      // Note: This documents current behavior - empty string is truthy in isConnected
      useConnectionStore.setState({ connectionString: '' })
      expect(useConnectionStore.getState().isConnected()).toBe(true)
    })
  })
})
