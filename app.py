import os
import logging

from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_login import LoginManager

# Configure logging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)
# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "developmentkeynotforproduction")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)  # needed for url_for to generate with https

# Configure the database
app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Konfiguracja PWA
app.config["PWA_ENABLED"] = True  # Włączenie wsparcia PWA
app.config["PWA_MANIFEST_PATH"] = "/static/manifest.json"

# Initialize Flask-Login
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
login_manager.login_message = 'Proszę zalogować się, aby uzyskać dostęp do tej strony.'

# Initialize the app with the extension
db.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    from models import User
    return User.query.get(int(user_id))

with app.app_context():
    # Make sure to import the models here or their tables won't be created
    import models  # noqa: F401
    
    if os.environ.get('INIT_DB') == '1':
        # Dla czystej instalacji - usuń wszystkie tabele i utwórz na nowo
        db.drop_all()
        db.create_all()
        app.logger.info("Zainicjalizowano bazę danych od zera.")
    else:
        # Standardowe zachowanie - tylko tworzy brakujące tabele
        db.create_all()
        app.logger.info("Zaktualizowano strukturę bazy danych.")
