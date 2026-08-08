package com.hyubs.skonnection

import android.app.Application

class SKonnectionApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
    }
}
