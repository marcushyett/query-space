import { describe, it, expect, beforeEach } from 'vitest'
import { useAiStore } from '../aiStore'

describe('aiStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useAiStore.setState({
      apiKey: null,
      persistApiKey: false,
    })
  })

  describe('initial state', () => {
    it('should have null API key initially', () => {
      const state = useAiStore.getState()
      expect(state.apiKey).toBeNull()
    })

    it('should have persistApiKey as false initially', () => {
      const state = useAiStore.getState()
      expect(state.persistApiKey).toBe(false)
    })

    it('should report no API key initially', () => {
      const state = useAiStore.getState()
      expect(state.hasApiKey()).toBe(false)
    })
  })

  describe('setApiKey', () => {
    it('should set API key', () => {
      const apiKey = 'sk-ant-test-key-12345'
      useAiStore.getState().setApiKey(apiKey)

      const state = useAiStore.getState()
      expect(state.apiKey).toBe(apiKey)
    })

    it('should report hasApiKey as true after setting', () => {
      useAiStore.getState().setApiKey('sk-ant-test-key')

      const state = useAiStore.getState()
      expect(state.hasApiKey()).toBe(true)
    })

    it('should update API key when called again', () => {
      useAiStore.getState().setApiKey('key1')
      useAiStore.getState().setApiKey('key2')

      const state = useAiStore.getState()
      expect(state.apiKey).toBe('key2')
    })
  })

  describe('clearApiKey', () => {
    it('should clear API key', () => {
      useAiStore.getState().setApiKey('sk-ant-test-key')
      useAiStore.getState().clearApiKey()

      const state = useAiStore.getState()
      expect(state.apiKey).toBeNull()
    })

    it('should report hasApiKey as false after clearing', () => {
      useAiStore.getState().setApiKey('sk-ant-test-key')
      useAiStore.getState().clearApiKey()

      const state = useAiStore.getState()
      expect(state.hasApiKey()).toBe(false)
    })
  })

  describe('setPersistApiKey', () => {
    it('should set persistApiKey to true', () => {
      useAiStore.getState().setPersistApiKey(true)

      const state = useAiStore.getState()
      expect(state.persistApiKey).toBe(true)
    })

    it('should set persistApiKey to false', () => {
      useAiStore.getState().setPersistApiKey(true)
      useAiStore.getState().setPersistApiKey(false)

      const state = useAiStore.getState()
      expect(state.persistApiKey).toBe(false)
    })

    it('should clear API key when disabling persistence', () => {
      useAiStore.getState().setApiKey('sk-ant-test-key')
      useAiStore.getState().setPersistApiKey(true)
      useAiStore.getState().setPersistApiKey(false)

      const state = useAiStore.getState()
      expect(state.apiKey).toBeNull()
    })
  })

  describe('hasApiKey', () => {
    it('should return false when API key is null', () => {
      useAiStore.setState({ apiKey: null })
      expect(useAiStore.getState().hasApiKey()).toBe(false)
    })

    it('should return false when API key is empty string', () => {
      useAiStore.setState({ apiKey: '' })
      expect(useAiStore.getState().hasApiKey()).toBe(false)
    })

    it('should return true when API key is set', () => {
      useAiStore.setState({ apiKey: 'sk-ant-test-key' })
      expect(useAiStore.getState().hasApiKey()).toBe(true)
    })
  })
})
