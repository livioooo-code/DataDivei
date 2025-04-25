import os
import requests
import json
import polyline
from flask import render_template, request, jsonify
from app import app, db
from models import Route

@app.route('/')
def index():
    """Render the main map page."""
    return render_template('index.html')

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
            
            # If you want to save the route
            if 'save' in request.args and request.args['save'] == 'true':
                name = request.args.get('name', f"Route with {len(waypoints)} waypoints")
                new_route = Route(
                    name=name,
                    start_lat=start[0],
                    start_lng=start[1],
                    end_lat=end[0],
                    end_lng=end[1],
                    polyline=geometry
                )
                db.session.add(new_route)
                db.session.commit()
            
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
