import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useToast, toast, reducer } from './use-toast'

// Helper to reset global state between tests
function resetToastState() {
  // Clear all toasts by accessing the module's internal state
  const { result } = renderHook(() => useToast())
  act(() => {
    result.current.toasts.forEach((t) => {
      result.current.dismiss(t.id)
    })
  })
  act(() => {
    vi.advanceTimersByTime(1000000)
  })
}

describe('use-toast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    resetToastState()
    vi.clearAllTimers()
    vi.restoreAllMocks()
  })
  describe('genId()', () => {
    // Note: genId is not exported, but we can test it indirectly through toast()
    it('should generate unique sequential IDs', () => {
      const toast1 = toast({ title: 'Test 1' })
      const toast2 = toast({ title: 'Test 2' })
      const toast3 = toast({ title: 'Test 3' })

      expect(toast1.id).not.toBe(toast2.id)
      expect(toast2.id).not.toBe(toast3.id)
      expect(toast1.id).not.toBe(toast3.id)
    })

    it('should generate numeric string IDs', () => {
      const result = toast({ title: 'Test' })
      expect(result.id).toMatch(/^\d+$/)
      expect(Number.parseInt(result.id)).not.toBeNaN()
    })

    it('should increment counter for each call', () => {
      const toast1 = toast({ title: 'Test 1' })
      const toast2 = toast({ title: 'Test 2' })

      const id1 = Number.parseInt(toast1.id)
      const id2 = Number.parseInt(toast2.id)

      expect(id2).toBeGreaterThan(id1)
    })
  })

  describe('reducer()', () => {
    const initialState = { toasts: [] }

    describe('ADD_TOAST', () => {
      it('should add a toast to empty state', () => {
        const toast = {
          id: '1',
          title: 'Test Toast',
          description: 'Test Description',
        }

        const newState = reducer(initialState, {
          type: 'ADD_TOAST',
          toast,
        })

        expect(newState.toasts).toHaveLength(1)
        expect(newState.toasts[0]).toEqual(toast)
      })

      it('should add new toast to beginning of array and respect TOAST_LIMIT', () => {
        const existingToast = {
          id: '1',
          title: 'First',
        }
        const newToast = {
          id: '2',
          title: 'Second',
        }

        const stateWithToast = { toasts: [existingToast] }
        const newState = reducer(stateWithToast, {
          type: 'ADD_TOAST',
          toast: newToast,
        })

        // New toast should be first, and TOAST_LIMIT (1) should be respected
        expect(newState.toasts[0]).toEqual(newToast)
        expect(newState.toasts).toHaveLength(1)
      })

      it('should respect TOAST_LIMIT and keep only the most recent toast', () => {
        const toast1 = { id: '1', title: 'First' }
        const toast2 = { id: '2', title: 'Second' }

        let state = reducer(initialState, { type: 'ADD_TOAST', toast: toast1 })
        state = reducer(state, { type: 'ADD_TOAST', toast: toast2 })

        // TOAST_LIMIT is 1, so only the most recent toast should remain
        expect(state.toasts).toHaveLength(1)
        expect(state.toasts[0]).toEqual(toast2)
      })

      it('should not mutate original state', () => {
        const originalState = { toasts: [] }
        const toast = { id: '1', title: 'Test' }

        reducer(originalState, { type: 'ADD_TOAST', toast })

        expect(originalState.toasts).toHaveLength(0)
      })
    })

    describe('UPDATE_TOAST', () => {
      it('should update existing toast by id', () => {
        const originalToast = {
          id: '1',
          title: 'Original Title',
          description: 'Original Description',
        }
        const state = { toasts: [originalToast] }

        const newState = reducer(state, {
          type: 'UPDATE_TOAST',
          toast: {
            id: '1',
            title: 'Updated Title',
          },
        })

        expect(newState.toasts[0].title).toBe('Updated Title')
        expect(newState.toasts[0].description).toBe('Original Description')
        expect(newState.toasts[0].id).toBe('1')
      })

      it('should not update toasts with different ids', () => {
        const toast1 = { id: '1', title: 'First' }
        const toast2 = { id: '2', title: 'Second' }
        const state = { toasts: [toast1, toast2] }

        const newState = reducer(state, {
          type: 'UPDATE_TOAST',
          toast: {
            id: '1',
            title: 'Updated',
          },
        })

        expect(newState.toasts[0].title).toBe('Updated')
        expect(newState.toasts[1].title).toBe('Second')
      })

      it('should handle partial toast updates', () => {
        const originalToast = {
          id: '1',
          title: 'Title',
          description: 'Description',
          variant: 'default' as const,
        }
        const state = { toasts: [originalToast] }

        const newState = reducer(state, {
          type: 'UPDATE_TOAST',
          toast: {
            id: '1',
            variant: 'destructive' as const,
          },
        })

        expect(newState.toasts[0]).toEqual({
          id: '1',
          title: 'Title',
          description: 'Description',
          variant: 'destructive',
        })
      })

      it('should return state unchanged if toast id not found', () => {
        const originalToast = { id: '1', title: 'First' }
        const state = { toasts: [originalToast] }

        const newState = reducer(state, {
          type: 'UPDATE_TOAST',
          toast: {
            id: '999',
            title: 'Updated',
          },
        })

        expect(newState.toasts[0]).toEqual(originalToast)
      })
    })

    describe('DISMISS_TOAST', () => {
      it('should set open to false for specific toast', () => {
        const toast1 = { id: '1', title: 'First', open: true }
        const toast2 = { id: '2', title: 'Second', open: true }
        const state = { toasts: [toast1, toast2] }

        const newState = reducer(state, {
          type: 'DISMISS_TOAST',
          toastId: '1',
        })

        expect(newState.toasts[0].open).toBe(false)
        expect(newState.toasts[1].open).toBe(true)
      })

      it('should set open to false for all toasts when toastId is undefined', () => {
        const toast1 = { id: '1', title: 'First', open: true }
        const toast2 = { id: '2', title: 'Second', open: true }
        const state = { toasts: [toast1, toast2] }

        const newState = reducer(state, {
          type: 'DISMISS_TOAST',
          toastId: undefined,
        })

        expect(newState.toasts[0].open).toBe(false)
        expect(newState.toasts[1].open).toBe(false)
      })

      it('should preserve other toast properties when dismissing', () => {
        const toast = {
          id: '1',
          title: 'Test',
          description: 'Description',
          open: true,
          variant: 'default' as const,
        }
        const state = { toasts: [toast] }

        const newState = reducer(state, {
          type: 'DISMISS_TOAST',
          toastId: '1',
        })

        expect(newState.toasts[0]).toEqual({
          ...toast,
          open: false,
        })
      })
    })

    describe('REMOVE_TOAST', () => {
      it('should remove specific toast by id', () => {
        const toast1 = { id: '1', title: 'First' }
        const toast2 = { id: '2', title: 'Second' }
        const state = { toasts: [toast1, toast2] }

        const newState = reducer(state, {
          type: 'REMOVE_TOAST',
          toastId: '1',
        })

        expect(newState.toasts).toHaveLength(1)
        expect(newState.toasts[0]).toEqual(toast2)
      })

      it('should remove all toasts when toastId is undefined', () => {
        const toast1 = { id: '1', title: 'First' }
        const toast2 = { id: '2', title: 'Second' }
        const state = { toasts: [toast1, toast2] }

        const newState = reducer(state, {
          type: 'REMOVE_TOAST',
          toastId: undefined,
        })

        expect(newState.toasts).toHaveLength(0)
      })

      it('should return unchanged state if toast id not found', () => {
        const toast1 = { id: '1', title: 'First' }
        const state = { toasts: [toast1] }

        const newState = reducer(state, {
          type: 'REMOVE_TOAST',
          toastId: '999',
        })

        expect(newState.toasts).toHaveLength(1)
        expect(newState.toasts[0]).toEqual(toast1)
      })

      it('should handle empty toasts array', () => {
        const state = { toasts: [] }

        const newState = reducer(state, {
          type: 'REMOVE_TOAST',
          toastId: '1',
        })

        expect(newState.toasts).toHaveLength(0)
      })
    })
  })

  describe('toast() function', () => {
    it('should create a toast and return an object with id, dismiss, and update', () => {
      const result = toast({ title: 'Test Toast' })

      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('dismiss')
      expect(result).toHaveProperty('update')
      expect(typeof result.id).toBe('string')
      expect(typeof result.dismiss).toBe('function')
      expect(typeof result.update).toBe('function')
    })

    it('should set open to true by default', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast({ title: 'Test' })
      })

      expect(result.current.toasts[0]?.open).toBe(true)
    })

    it('should include all provided properties', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast({
          title: 'Test Title',
          description: 'Test Description',
          variant: 'destructive',
        })
      })

      const createdToast = result.current.toasts[0]
      expect(createdToast?.title).toBe('Test Title')
      expect(createdToast?.description).toBe('Test Description')
      expect(createdToast?.variant).toBe('destructive')
    })

    it('should update toast when update function is called', () => {
      const { result } = renderHook(() => useToast())
      let toastResult: ReturnType<typeof toast>

      act(() => {
        toastResult = toast({ title: 'Original' })
      })

      act(() => {
        toastResult.update({
          id: toastResult.id,
          title: 'Updated',
        })
      })

      expect(result.current.toasts[0]?.title).toBe('Updated')
    })

    it('should dismiss toast when dismiss function is called', () => {
      const { result } = renderHook(() => useToast())
      let toastResult: ReturnType<typeof toast>

      act(() => {
        toastResult = toast({ title: 'Test' })
      })

      expect(result.current.toasts[0]?.open).toBe(true)

      act(() => {
        toastResult.dismiss()
      })

      expect(result.current.toasts[0]?.open).toBe(false)
    })

    it('should call dismiss when onOpenChange is called with false', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast({ title: 'Test' })
      })

      const createdToast = result.current.toasts[0]
      expect(createdToast?.open).toBe(true)

      act(() => {
        createdToast?.onOpenChange?.(false)
      })

      expect(result.current.toasts[0]?.open).toBe(false)
    })

    it('should handle React nodes as title and description', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast({
          title: <span>Title</span>,
          description: <div>Description</div>,
        })
      })

      const createdToast = result.current.toasts[0]
      expect(createdToast?.title).toBeDefined()
      expect(createdToast?.description).toBeDefined()
    })
  })

  describe('useToast() hook', () => {
    it('should return initial empty state', () => {
      const { result } = renderHook(() => useToast())

      expect(result.current.toasts).toEqual([])
    })

    it('should return toast function', () => {
      const { result } = renderHook(() => useToast())

      expect(result.current.toast).toBe(toast)
    })

    it('should return dismiss function', () => {
      const { result } = renderHook(() => useToast())

      expect(typeof result.current.dismiss).toBe('function')
    })

    it('should update state when toast is added', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast({ title: 'Test Toast' })
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0]?.title).toBe('Test Toast')
    })

    it('should update state when toast is dismissed', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast({ title: 'Test' })
      })

      const toastId = result.current.toasts[0]?.id

      act(() => {
        result.current.dismiss(toastId)
      })

      expect(result.current.toasts[0]?.open).toBe(false)
    })

    it('should dismiss all toasts when dismiss is called without id', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast({ title: 'Toast 1' })
      })

      act(() => {
        result.current.dismiss()
      })

      // With TOAST_LIMIT = 1, we'll only have one toast
      expect(result.current.toasts[0]?.open).toBe(false)
    })

    it('should sync state across multiple hook instances', () => {
      const { result: result1 } = renderHook(() => useToast())
      const { result: result2 } = renderHook(() => useToast())

      act(() => {
        toast({ title: 'Shared Toast' })
      })

      expect(result1.current.toasts).toHaveLength(1)
      expect(result2.current.toasts).toHaveLength(1)
      expect(result1.current.toasts[0]?.id).toBe(result2.current.toasts[0]?.id)
    })

    it('should cleanup listener on unmount', () => {
      const { result, unmount } = renderHook(() => useToast())

      act(() => {
        toast({ title: 'Test' })
      })

      expect(result.current.toasts).toHaveLength(1)

      unmount()

      // After unmount, the listener should be removed
      // We can verify this by checking that a new toast doesn't update the old hook
      const { result: result2 } = renderHook(() => useToast())

      act(() => {
        toast({ title: 'New Toast' })
      })

      // New hook should see the new toast
      expect(result2.current.toasts).toHaveLength(1)
    })
  })

  describe('addToRemoveQueue() integration', () => {
    it('should remove toast after TOAST_REMOVE_DELAY when dismissed', async () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast({ title: 'Test' })
      })

      const toastId = result.current.toasts[0]?.id

      act(() => {
        result.current.dismiss(toastId)
      })

      // Toast should be dismissed (open: false)
      expect(result.current.toasts[0]?.open).toBe(false)

      // Fast-forward time by TOAST_REMOVE_DELAY (1000000ms)
      act(() => {
        vi.advanceTimersByTime(1000000)
      })

      // Toast should be removed from state
      expect(result.current.toasts).toHaveLength(0)
    })

    it('should not create duplicate timeouts for the same toast', async () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast({ title: 'Test' })
      })

      const toastId = result.current.toasts[0]?.id

      // Dismiss multiple times
      act(() => {
        result.current.dismiss(toastId)
        result.current.dismiss(toastId)
        result.current.dismiss(toastId)
      })

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(1000000)
      })

      // Toast should only be removed once
      expect(result.current.toasts).toHaveLength(0)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle toast with no title or description', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast({})
      })

      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0]?.id).toBeDefined()
    })

    it('should handle multiple rapid toast creations', () => {
      const { result } = renderHook(() => useToast())

      act(() => {
        toast({ title: 'Toast 1' })
        toast({ title: 'Toast 2' })
        toast({ title: 'Toast 3' })
      })

      // Due to TOAST_LIMIT = 1, only the last toast should remain
      expect(result.current.toasts).toHaveLength(1)
      expect(result.current.toasts[0]?.title).toBe('Toast 3')
    })

    it('should handle toast with all possible variants', () => {
      const { result } = renderHook(() => useToast())
      const variants = ['default', 'destructive'] as const

      variants.forEach((variant) => {
        act(() => {
          toast({ title: `${variant} toast`, variant })
        })

        expect(result.current.toasts[0]?.variant).toBe(variant)
      })
    })
  })
})
