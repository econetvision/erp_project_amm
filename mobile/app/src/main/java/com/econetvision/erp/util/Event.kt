package com.econetvision.erp.util

import androidx.lifecycle.LifecycleOwner
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData

/**
 * Wrapper for a value that represents a one-shot event — a toast to show, a form
 * result, a navigation trigger.
 *
 * LiveData re-delivers its most recent value to every new observer. For state
 * (the current user, the attendance list) that is exactly what you want, but for
 * a one-shot result it means the previous outcome is replayed whenever a
 * fragment's view is recreated: stale error toasts on rotation, a duplicate
 * "Attendance recorded" after coming back to the tab, and — worst — a dialog that
 * dismisses itself the instant it reopens because the *previous* save result is
 * redelivered. An [Event] is consumed exactly once.
 */
class Event<out T>(private val content: T) {

    var hasBeenHandled = false
        private set

    /** Returns the content the first time it is called, and null on every call after. */
    fun getContentIfNotHandled(): T? {
        return if (hasBeenHandled) {
            null
        } else {
            hasBeenHandled = true
            content
        }
    }
}

/** Observe an event stream, invoking [onEvent] only for events not yet consumed. */
fun <T> LiveData<Event<T>>.observeEvent(owner: LifecycleOwner, onEvent: (T) -> Unit) {
    observe(owner) { event -> event.getContentIfNotHandled()?.let(onEvent) }
}

/** Emit [value] as a fresh one-shot event. */
fun <T> MutableLiveData<Event<T>>.emit(value: T) {
    this.value = Event(value)
}
