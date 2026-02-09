from app import create_app
import os

# Create the Flask app instance
app = create_app()

if __name__ == '__main__':
    # This block only runs for local development (python run.py)
    # On Render, gunicorn will use the 'app' object directly
    from app.background_tasks import start_session_monitor
    
    print("\n" + "="*60)
    print("Starting HR Evaluation System Backend (Development Mode)")
    print("="*60)
    
    # Start monitoring for stale exam sessions
    monitor = start_session_monitor(app, check_interval=30, inactivity_threshold=120)
    
    print("\n🚀 System ready!")
    print("="*60 + "\n")
    
    port = int(os.getenv('PORT', 5000))
    
    try:
        app.run(host='0.0.0.0', port=port, debug=False, use_reloader=False)
    except KeyboardInterrupt:
        print("\n\n" + "="*60)
        print("Shutting down...")
        print("="*60)
        from app.background_tasks import stop_session_monitor
        stop_session_monitor()
        print("\n✓ Shutdown complete")