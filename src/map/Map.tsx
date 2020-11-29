import React from "react";
import {TileLayer, MapContainer, Marker, Popup, Tooltip} from "react-leaflet";
import L from "leaflet";

import {Telex, TelexConnection, Airport, AirportResponse} from "@flybywiresim/api-client";

import "leaflet/dist/leaflet.css";
import "./Map.scss";

type MapState = {
    totalFlights: number,
    selectedTile: TileSet,
}

type FlightsProps = {
    updateTotalFlights: Function,
    planeColor: string,
    airportColor: string,
}

type FlightsState = {
    isUpdating: boolean,
    data: TelexConnection[],
    selectedAirports: SelectedAirportType[],
}

type SelectedAirportType = {
    airport: AirportResponse,
    tag: string
}

type InfoWidgetProps = {
    totalFlights: number,
    tiles: TileSet[],
    changeTiles: Function,
}

type TileSet = {
    value: string,
    name: string,
    attribution: string,
    url: string,
    planeColor: string,
    airportColor: string,
}

export default class Map extends React.Component<any, MapState> {
    availableTileSets: TileSet[] = [
        {
            value: "carto-dark",
            name: "Carto Dark",
            attribution: "&copy; <a href=\"http://www.openstreetmap.org/copyright\">OpenStreetMap</a> &copy; <a href=\"http://cartodb.com/attributions\">CartoDB</a>",
            url: "https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png",
            planeColor: "#00c2cb",
            airportColor: "#ffffff"
        },
        {
            value: "carto-light",
            name: "Carto Light",
            attribution: "&copy; <a href=\"http://www.openstreetmap.org/copyright\">OpenStreetMap</a> &copy; <a href=\"http://cartodb.com/attributions\">CartoDB</a>",
            url: "https://cartodb-basemaps-{s}.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png",
            planeColor: "#545454",
            airportColor: "#00c2cb"
        },
        {
            value: "osm",
            name: "Open Street Map",
            attribution: "&copy; <a href=\"http://osm.org/copyright\">OpenStreetMap</a> contributors",
            url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
            planeColor: "#545454",
            airportColor: "#00c2cb"
        },
        {
            value: "arcgis",
            name: "Satellite",
            attribution: "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
            url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            planeColor: "#00c2cb",
            airportColor: "#ffffff"
        }
    ]

    state: MapState = {
        totalFlights: 0,
        selectedTile: this.findPreferredTile(),
    }

    constructor(props: any) {
        super(props);
        this.updateTotalFlights = this.updateTotalFlights.bind(this);
        this.selectTile = this.selectTile.bind(this);
    }

    findPreferredTile(): TileSet {
        try {
            const storedTiles = window.localStorage.getItem("PreferredTileset");
            if (!storedTiles) {
                return this.availableTileSets[0];
            }

            return this.availableTileSets.find(x => x.value === storedTiles) || this.availableTileSets[0];
        } catch {
            return this.availableTileSets[0];
        }
    }

    updateTotalFlights(flights: number) {
        this.setState({totalFlights: flights});
        this.forceUpdate();
    }

    selectTile(tile: string | null) {
        if (!tile) {
            return this.availableTileSets[0];
        }

        const newTiles = this.availableTileSets.find(x => x.value === tile) || this.availableTileSets[0];

        this.setState({selectedTile: newTiles});
        window.localStorage.setItem("PreferredTileset", newTiles.value);

        location.reload();
    }

    render() {
        return (
            <div>
                <MapContainer
                    id="mapid"
                    center={[51.505, -0.09]}
                    zoom={5}
                    scrollWheelZoom={true}>
                    <TileLayer attribution={this.state.selectedTile.attribution} url={this.state.selectedTile.url} />
                    <Flights planeColor={this.state.selectedTile.planeColor} airportColor={this.state.selectedTile.airportColor} updateTotalFlights={this.updateTotalFlights}/>
                    <InfoWidget totalFlights={this.state.totalFlights} tiles={this.availableTileSets} changeTiles={this.selectTile}/>
                </MapContainer>
            </div>
        );
    }
}

class Flights extends React.Component<FlightsProps, FlightsState> {
    constructor(props: FlightsProps) {
        super(props);
    }

    intervalID: any;

    state: FlightsState = {
        isUpdating: false,
        data: [],
        selectedAirports: [],
    };

    componentDidMount() {
        this.getLocationData(true);
    }

    componentWillUnmount() {
        if (this.intervalID) {
            clearTimeout(this.intervalID);
        }
    }

    async getLocationData(staged: boolean = false) {
        console.log("Starting update");

        this.setState({
            isUpdating: true
        });

        let flights: TelexConnection[] = [];
        let skip = 0;
        let total = 0;

        do {
            try {
                const data = await Telex.fetchConnections(skip, 100);

                total = data.total;
                skip += data.count;
                flights = flights.concat(data.results);

                if (staged) {
                    this.setState({
                        data: flights
                    });
                }
            } catch (err) {
                console.error(err);
                break;
            }
        }
        while (total > skip);

        this.setState({
            isUpdating: false,
            data: flights
        });
        this.props.updateTotalFlights(total);
        this.intervalID = setTimeout(this.getLocationData.bind(this), 10000);
        console.log("Update finished");
    }

    async getAirports(origin: string, destination: string) {
        const airports: SelectedAirportType[] = [];

        // Two individual try/catch: If one fails the other should still show
        if (origin) {
            try {
                const originArpt = await Airport.get(origin);
                airports.push({airport: originArpt, tag: 'origin'});
            } catch (e) {
                console.error(e);
            }
        }

        if (destination) {
            try {
                const destinationArpt = await Airport.get(destination);
                airports.push({airport: destinationArpt, tag: 'destination'});
            } catch (e) {
                console.error(e);
            }
        }

        this.setState({selectedAirports: airports});
    }

    clearAirports() {
        this.setState({selectedAirports: []});
    }

    render() {
        return (
            <div>
                {
                    this.state.data.map((flight: TelexConnection) =>
                        <Marker
                            key={flight.id}
                            position={[flight.location.y, flight.location.x]}
                            icon={L.divIcon({
                                iconSize: [20, 20],
                                iconAnchor: [14, 10],
                                className: 'planeIcon',
                                html: `<i 
                                style="font-size: 1.75rem; color: ${this.props.planeColor};transform-origin: center; transform: rotate(${flight.heading}deg);" 
                                class="material-icons">flight</i>`
                            })}>
                            <Popup onOpen={() => this.getAirports(flight.origin, flight.destination)} onClose={() => this.clearAirports()}>
                                {
                                    !((flight.origin === "") || (flight.destination === "")) ?
                                        `Flight ${flight.flight} flying from ${flight.origin} to ${flight.destination} at ${flight.trueAltitude}ft`
                                        :
                                        !(flight.flight === "") ? `Flight ${flight.flight}` : flight.aircraftType
                                }
                            </Popup>
                        </Marker>
                    )
                }
                {
                    this.state.selectedAirports.map(airport =>
                        <Marker
                            position={[airport.airport.lat, airport.airport.lon]}
                            icon={L.divIcon({
                                iconSize: [20, 20],
                                iconAnchor: [14, 10],
                                className: "airportIcon",
                                html: `<i 
                                    style="font-size: 1.75rem; color: ${this.props.airportColor};" 
                                    class="material-icons">${(airport.tag === "destination") ? 'flight_land' : 'flight_takeoff'}</i>`
                            })}>
                            <Tooltip direction="top" permanent>
                                <p>{airport.airport.icao} - {airport.airport.name}</p>
                            </Tooltip>
                        </Marker>
                    )
                }
            </div>
        );
    }
}

class InfoWidget extends React.Component<InfoWidgetProps, any> {
    retrieveActiveTileSet() {
        try {
            const storedTiles = window.localStorage.getItem("PreferredTileset");
            if (!storedTiles) {
                return this.props.tiles[0];
            }

            return this.props.tiles.find(x => x.value === storedTiles) || this.props.tiles[0];
        } catch {
            return this.props.tiles[0];
        }
    }

    render() {
        return (
            <div className="leaflet-bottom leaflet-left" id="MapPanel">
                <p className="PanelText">Total Flights: {this.props.totalFlights}</p>
                <p className="PanelText">
                    {"Tile type: "}
                    <select defaultValue={this.retrieveActiveTileSet().value} onChange={(event) => this.props.changeTiles(event.target.value)}>
                        {
                            this.props.tiles.map((tiles: TileSet) =>
                                <option value={tiles.value}>{tiles.name}</option>
                            )
                        }
                    </select>
                </p>
            </div>
        );
    }
}
