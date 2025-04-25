import os
import requests
import json
import polyline
from datetime import datetime
from urllib.parse import urlparse
from flask import render_template, request, jsonify, url_for, redirect, flash
from flask_login import login_user, logout_user, login_required, current_user
from app import app, db
from models import Route, User, user_routes, Courier, Delivery, DeliveryStatusHistory
from werkzeug.security import generate_password_hash, check_password_hash
from forms import (
    LoginForm, RegistrationForm, CourierProfileForm, DeliveryForm,
    DeliveryStatusUpdateForm, CourierStatusForm, DeliveryFilterForm
)

@app.route('/')
def index():
    """Render the main map page."""
    return render_template('index.html')

@app.route('/sw.js')
def service_worker():
    """Serve the service worker file with proper MIME type."""
    return app.send_static_file('service-worker.js'), 200, {'Content-Type': 'application/javascript'}

# ======== Funkcje dla kurierów ========

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Obsługa logowania użytkownika."""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(username=form.username.data).first()
        
        if user and check_password_hash(user.password_hash, form.password.data):
            login_user(user, remember=form.remember.data)
            next_page = request.args.get('next')
            if not next_page or urlparse(next_page).netloc != '':
                next_page = url_for('dashboard')
            return redirect(next_page)
        
        flash('Nieprawidłowa nazwa użytkownika lub hasło.', 'danger')
    
    return render_template('login.html', form=form)

@app.route('/logout')
def logout():
    """Wylogowanie użytkownika."""
    logout_user()
    return redirect(url_for('index'))

@app.route('/register', methods=['GET', 'POST'])
def register():
    """Rejestracja nowego użytkownika."""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    
    form = RegistrationForm()
    if form.validate_on_submit():
        hashed_password = generate_password_hash(form.password.data)
        
        # Tworzenie nowego użytkownika
        user = User(
            username=form.username.data,
            email=form.email.data,
            password_hash=hashed_password,
            first_name=form.first_name.data,
            last_name=form.last_name.data,
            phone=form.phone.data,
            is_courier=form.is_courier.data
        )
        
        try:
            db.session.add(user)
            db.session.commit()
            
            # Jeśli rejestracja jako kurier, przekieruj do uzupełnienia profilu kuriera
            if form.is_courier.data:
                # Utwórz podstawowy profil kuriera
                courier = Courier(user_id=user.id)
                db.session.add(courier)
                db.session.commit()
                
                flash('Rejestracja pomyślna! Uzupełnij swój profil kuriera.', 'success')
                login_user(user)
                return redirect(url_for('courier_profile'))
            
            flash('Rejestracja pomyślna! Możesz się zalogować.', 'success')
            return redirect(url_for('login'))
            
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Błąd rejestracji: {str(e)}")
            flash('Wystąpił błąd podczas rejestracji. Spróbuj ponownie.', 'danger')
    
    return render_template('register.html', form=form)

@app.route('/dashboard')
@login_required
def dashboard():
    """Panel główny użytkownika."""
    if current_user.is_courier:
        # Dla kuriera pokazujemy inne informacje
        courier = Courier.query.filter_by(user_id=current_user.id).first()
        
        # Pobierz przypisane dostawy
        assigned_deliveries = Delivery.query.filter_by(courier_id=courier.id).all()
        
        # Pobierz dzisiejsze dostawy
        today = datetime.now().date()
        today_deliveries = Delivery.query.filter(
            Delivery.courier_id == courier.id,
            db.func.date(Delivery.estimated_delivery_time) == today
        ).all()
        
        # Statystyki dostarczonych przesyłek
        total_delivered = Delivery.query.filter_by(
            courier_id=courier.id, 
            status='delivered'
        ).count()
        
        return render_template(
            'courier_dashboard.html', 
            courier=courier,
            assigned_deliveries=assigned_deliveries,
            today_deliveries=today_deliveries,
            total_delivered=total_delivered
        )
    else:
        # Dla zwykłego użytkownika
        return render_template('user_dashboard.html')

@app.route('/courier/profile', methods=['GET', 'POST'])
@login_required
def courier_profile():
    """Zarządzanie profilem kuriera."""
    if not current_user.is_courier:
        flash('Tylko kurierzy mają dostęp do tej strony.', 'warning')
        return redirect(url_for('dashboard'))
    
    courier = Courier.query.filter_by(user_id=current_user.id).first()
    if not courier:
        flash('Nie znaleziono profilu kuriera.', 'danger')
        return redirect(url_for('dashboard'))
    
    form = CourierProfileForm(obj=courier)
    
    if form.validate_on_submit():
        form.populate_obj(courier)
        
        # Obsługa przesyłanego zdjęcia profilowego
        if form.profile_picture.data:
            # Tutaj dodamy obsługę zapisu zdjęcia
            pass
        
        try:
            db.session.commit()
            flash('Profil został zaktualizowany.', 'success')
            return redirect(url_for('courier_profile'))
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Błąd aktualizacji profilu: {str(e)}")
            flash('Wystąpił błąd podczas aktualizacji profilu.', 'danger')
    
    return render_template('courier_profile.html', form=form, courier=courier)

@app.route('/courier/status/update', methods=['POST'])
@login_required
def update_courier_status():
    """Aktualizacja statusu kuriera."""
    if not current_user.is_courier:
        return jsonify({'error': 'Brak uprawnień'}), 403
    
    data = request.get_json()
    if not data or 'status' not in data:
        return jsonify({'error': 'Brak wymaganego statusu'}), 400
    
    valid_statuses = ['online', 'busy', 'offline']
    if data['status'] not in valid_statuses:
        return jsonify({'error': 'Nieprawidłowy status'}), 400
    
    try:
        courier = Courier.query.filter_by(user_id=current_user.id).first()
        if not courier:
            return jsonify({'error': 'Nie znaleziono profilu kuriera'}), 404
        
        courier.status = data['status']
        
        # Aktualizacja lokalizacji jeśli podano
        if 'lat' in data and 'lng' in data:
            courier.current_lat = data['lat']
            courier.current_lng = data['lng']
            courier.last_location_update = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Status zaktualizowany na: {courier.status}',
            'status': courier.status
        })
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Błąd aktualizacji statusu: {str(e)}")
        return jsonify({'error': f'Wystąpił błąd: {str(e)}'}), 500

@app.route('/courier/deliveries')
@login_required
def courier_deliveries():
    """Lista dostaw dla kuriera."""
    if not current_user.is_courier:
        flash('Tylko kurierzy mają dostęp do tej strony.', 'warning')
        return redirect(url_for('dashboard'))
    
    courier = Courier.query.filter_by(user_id=current_user.id).first()
    
    # Filtrowanie dostaw
    filter_form = DeliveryFilterForm(request.args, meta={'csrf': False})
    status_filter = request.args.get('status', 'all')
    
    # Bazowe zapytanie - dostawy przypisane do kuriera
    query = Delivery.query.filter_by(courier_id=courier.id)
    
    # Filtrowanie po statusie
    if status_filter != 'all':
        query = query.filter(Delivery.status == status_filter)
    
    # Filtrowanie po dacie
    if filter_form.date_from.data:
        query = query.filter(Delivery.created_at >= filter_form.date_from.data)
    if filter_form.date_to.data:
        query = query.filter(Delivery.created_at <= filter_form.date_to.data)
    
    # Wyszukiwanie
    if filter_form.search.data:
        search_term = f"%{filter_form.search.data}%"
        query = query.filter(
            db.or_(
                Delivery.recipient_name.like(search_term),
                Delivery.package_id.like(search_term),
                Delivery.pickup_address.like(search_term),
                Delivery.delivery_address.like(search_term)
            )
        )
    
    # Sortowanie - domyślnie po dacie utworzenia (najnowsze pierwsze)
    deliveries = query.order_by(Delivery.created_at.desc()).all()
    
    return render_template(
        'courier_deliveries.html',
        deliveries=deliveries,
        filter_form=filter_form
    )

@app.route('/courier/delivery/<int:delivery_id>')
@login_required
def courier_delivery_details(delivery_id):
    """Szczegóły dostawy dla kuriera."""
    if not current_user.is_courier:
        flash('Tylko kurierzy mają dostęp do tej strony.', 'warning')
        return redirect(url_for('dashboard'))
    
    courier = Courier.query.filter_by(user_id=current_user.id).first()
    delivery = Delivery.query.get_or_404(delivery_id)
    
    # Sprawdź czy dostawa jest przypisana do tego kuriera
    if delivery.courier_id != courier.id:
        flash('Nie masz dostępu do tej dostawy.', 'danger')
        return redirect(url_for('courier_deliveries'))
    
    # Pobierz historię statusów dostawy
    status_history = DeliveryStatusHistory.query.filter_by(
        delivery_id=delivery.id
    ).order_by(DeliveryStatusHistory.timestamp.desc()).all()
    
    status_form = DeliveryStatusUpdateForm(obj=delivery)
    
    return render_template(
        'courier_delivery_details.html',
        delivery=delivery,
        status_history=status_history,
        status_form=status_form
    )

@app.route('/courier/delivery/<int:delivery_id>/update', methods=['POST'])
@login_required
def update_delivery_status(delivery_id):
    """Aktualizacja statusu dostawy przez kuriera."""
    if not current_user.is_courier:
        flash('Tylko kurierzy mają dostęp do tej funkcji.', 'warning')
        return redirect(url_for('dashboard'))
    
    courier = Courier.query.filter_by(user_id=current_user.id).first()
    delivery = Delivery.query.get_or_404(delivery_id)
    
    # Sprawdź czy dostawa jest przypisana do tego kuriera
    if delivery.courier_id != courier.id:
        flash('Nie masz dostępu do tej dostawy.', 'danger')
        return redirect(url_for('courier_deliveries'))
    
    form = DeliveryStatusUpdateForm()
    
    if form.validate_on_submit():
        # Aktualizuj status dostawy
        delivery.status = form.status.data
        delivery.notes = form.notes.data
        
        # Dodaj wpis do historii statusów
        status_history = DeliveryStatusHistory(
            delivery_id=delivery.id,
            status=form.status.data,
            notes=form.notes.data,
            latitude=form.current_lat.data if form.current_lat.data else None,
            longitude=form.current_lng.data if form.current_lng.data else None
        )
        
        # Dodaj zdjęcie potwierdzenia (jeśli przesłano)
        if form.delivery_photo.data:
            # Tutaj dodamy obsługę zapisu zdjęcia
            pass
        
        # Aktualizacja timestampów zależnych od statusu
        if form.status.data == 'picked_up':
            delivery.pickup_time = datetime.utcnow()
        elif form.status.data == 'delivered':
            delivery.delivery_time = datetime.utcnow()
        
        try:
            db.session.add(status_history)
            db.session.commit()
            flash(f'Status dostawy zaktualizowany na: {form.status.data}', 'success')
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Błąd aktualizacji statusu dostawy: {str(e)}")
            flash('Wystąpił błąd podczas aktualizacji statusu.', 'danger')
    else:
        for field, errors in form.errors.items():
            for error in errors:
                flash(f"Błąd w polu {getattr(form, field).label.text}: {error}", 'danger')
    
    return redirect(url_for('courier_delivery_details', delivery_id=delivery.id))

@app.route('/courier/available-deliveries')
@login_required
def available_deliveries():
    """Dostępne dostawy do podjęcia dla kuriera."""
    if not current_user.is_courier:
        flash('Tylko kurierzy mają dostęp do tej strony.', 'warning')
        return redirect(url_for('dashboard'))
    
    courier = Courier.query.filter_by(user_id=current_user.id).first()
    
    # Pobierz nieprzypisane dostawy
    available_deliveries = Delivery.query.filter_by(status='new', courier_id=None).all()
    
    return render_template(
        'available_deliveries.html',
        deliveries=available_deliveries,
        courier=courier
    )

@app.route('/courier/delivery/<int:delivery_id>/accept', methods=['POST'])
@login_required
def accept_delivery(delivery_id):
    """Akceptacja dostawy przez kuriera."""
    if not current_user.is_courier:
        flash('Tylko kurierzy mają dostęp do tej funkcji.', 'warning')
        return redirect(url_for('dashboard'))
    
    courier = Courier.query.filter_by(user_id=current_user.id).first()
    delivery = Delivery.query.get_or_404(delivery_id)
    
    # Sprawdź czy dostawa jest dostępna
    if delivery.courier_id is not None:
        flash('Ta dostawa jest już przypisana do innego kuriera.', 'warning')
        return redirect(url_for('available_deliveries'))
    
    # Przypisz dostawę do kuriera
    delivery.courier_id = courier.id
    delivery.status = 'assigned'
    
    # Dodaj wpis w historii statusów
    status_history = DeliveryStatusHistory(
        delivery_id=delivery.id,
        status='assigned',
        notes=f'Przypisana do kuriera: {current_user.username}'
    )
    
    try:
        db.session.add(status_history)
        db.session.commit()
        flash('Dostawa została przypisana do Ciebie.', 'success')
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Błąd akceptacji dostawy: {str(e)}")
        flash('Wystąpił błąd podczas akceptacji dostawy.', 'danger')
    
    return redirect(url_for('courier_delivery_details', delivery_id=delivery.id))

@app.route('/api/routes', methods=['GET'])
def get_routes():
    """Get all saved routes."""
    routes = Route.query.all()
    return jsonify([route.to_dict() for route in routes])

@app.route('/api/route/<int:route_id>', methods=['GET'])
def get_route(route_id):
    """Get a specific route by ID."""
    route = Route.query.get_or_404(route_id)
    return jsonify(route.to_dict())

@app.route('/api/directions', methods=['POST'])
def get_directions():
    """Get directions between multiple points using OSRM."""
    data = request.get_json()
    
    if not data or 'start' not in data or 'end' not in data:
        return jsonify({'error': 'Missing start or end coordinates'}), 400
    
    start = data['start']  # [lat, lng]
    end = data['end']      # [lat, lng]
    waypoints = data.get('waypoints', [])  # optional waypoints [[lat, lng], [lat, lng], ...]
    optimize = data.get('optimize', False)  # optional waypoint optimization flag
    
    # Build coordinates string for OSRM API
    coords = [f"{start[1]},{start[0]}"]  # Start with origin (lng,lat format for OSRM)
    
    # Add any waypoints
    for point in waypoints:
        coords.append(f"{point[1]},{point[0]}")
        
    # Add destination
    coords.append(f"{end[1]},{end[0]}")
    
    # Build OSRM API URL
    coords_str = ";".join(coords)
    osrm_url = f"http://router.project-osrm.org/route/v1/driving/{coords_str}?overview=full&geometries=polyline"
    
    # Add optimization if requested
    if optimize and len(waypoints) > 0:
        osrm_url += "&annotations=true&steps=true"
    
    try:
        app.logger.debug(f"Requesting route from OSRM: {osrm_url}")
        response = requests.get(osrm_url)
        data = response.json()
        
        if 'routes' in data and len(data['routes']) > 0:
            route_data = data['routes'][0]
            geometry = route_data['geometry']  # This is already an encoded polyline
            
            # For saving routes later
            route_save_data = {
                'geometry': geometry,
                'distance': route_data['distance'],
                'duration': route_data['duration'],
                'start': start,
                'end': end,
                'waypoints': waypoints
            }
            
            decoded_polyline = polyline.decode(geometry)
            
            # Return enhanced route information
            result = {
                'route': decoded_polyline,
                'encoded_polyline': geometry,
                'distance': route_data['distance'],
                'duration': route_data['duration'],
                'waypoints': waypoints,
                'legs': []
            }
            
            # Add leg information if available
            if 'legs' in route_data:
                for i, leg in enumerate(route_data['legs']):
                    leg_info = {
                        'distance': leg['distance'],
                        'duration': leg['duration'],
                    }
                    
                    # Add origin and destination info for this leg
                    if i == 0:
                        leg_info['from'] = 'Origin'
                    else:
                        leg_info['from'] = f'Waypoint {i}'
                        
                    if i == len(route_data['legs']) - 1:
                        leg_info['to'] = 'Destination'
                    else:
                        leg_info['to'] = f'Waypoint {i+1}'
                        
                    result['legs'].append(leg_info)
            
            return jsonify(result)
        else:
            app.logger.warning(f"No route found. OSRM response: {data}")
            return jsonify({'error': 'No route found'}), 404
            
    except requests.RequestException as e:
        app.logger.error(f"Error fetching directions: {str(e)}")
        return jsonify({'error': 'Failed to fetch directions'}), 500

@app.route('/api/routes', methods=['POST'])
def save_route():
    """Save a route to the database."""
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Missing route data'}), 400
        
    required_fields = ['start', 'end', 'name', 'encoded_polyline', 'distance', 'duration']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'Missing required field: {field}'}), 400
    
    start = data['start']  # [lat, lng]
    end = data['end']      # [lat, lng]
    waypoints = data.get('waypoints', [])
    
    # Create new route record
    new_route = Route(
        name=data['name'],
        description=data.get('description', ''),
        start_lat=start[0],
        start_lng=start[1],
        end_lat=end[0],
        end_lng=end[1],
        polyline=data['encoded_polyline'],
        distance=data['distance'],
        duration=data['duration'],
        waypoints=json.dumps(waypoints) if waypoints else None
    )
    
    try:
        db.session.add(new_route)
        db.session.commit()
        
        return jsonify({
            'message': 'Route saved successfully',
            'route_id': new_route.id,
            'route': new_route.to_dict()
        })
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Error saving route: {str(e)}")
        return jsonify({'error': 'Failed to save route'}), 500
        
@app.route('/api/geocode', methods=['GET'])
def geocode_address():
    """Geocode an address to coordinates using OpenStreetMap Nominatim API."""
    query = request.args.get('query')
    
    if not query:
        return jsonify({'error': 'Missing address query'}), 400
    
    # Use OpenStreetMap Nominatim API for geocoding
    nominatim_url = "https://nominatim.openstreetmap.org/search"
    params = {
        'q': query,
        'format': 'json',
        'limit': 5,
        'addressdetails': 1
    }
    
    headers = {
        'User-Agent': 'RouteGuidanceApp/1.0'  # Required by Nominatim ToS
    }
    
    try:
        response = requests.get(nominatim_url, params=params, headers=headers)
        data = response.json()
        
        if data and len(data) > 0:
            results = []
            for item in data:
                results.append({
                    'lat': float(item['lat']),
                    'lng': float(item['lon']),
                    'display_name': item['display_name'],
                    'type': item.get('type'),
                    'importance': item.get('importance', 0)
                })
            return jsonify(results)
        else:
            return jsonify({'error': 'No results found'}), 404
            
    except requests.RequestException as e:
        app.logger.error(f"Error geocoding address: {str(e)}")
        return jsonify({'error': 'Failed to geocode address'}), 500
