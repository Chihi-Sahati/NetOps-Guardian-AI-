import importlib
import inspect
import logging
import os
import pkgutil
from typing import Dict, Optional, Type

from .base import NetworkConnector

logger = logging.getLogger("ConnectorRegistry")

class ConnectorRegistry:
    """
    Dynamic plugin registry that discovers and manages all Network Connectors.
    Allows dynamic loading of new vendor connectors without changing core code.
    """
    _connectors: Dict[str, Type[NetworkConnector]] = {}
    _is_loaded = False

    @classmethod
    def load_connectors(cls) -> None:
        """Autodiscover and load all valid plugins in the connectors package."""
        if cls._is_loaded:
            return

        current_dir = os.path.dirname(__file__)
        package_name = __name__.rsplit('.', 1)[0]  # Get the package string (e.g. src.noc.connectors)

        for _, module_name, is_pkg in pkgutil.iter_modules([current_dir]):
            if not is_pkg and module_name not in ['base', 'registry', '__init__']:
                full_module_name = f"{package_name}.{module_name}"
                try:
                    module = importlib.import_module(full_module_name)
                    # Find classes that inherit from NetworkConnector
                    for name, obj in inspect.getmembers(module, inspect.isclass):
                        if issubclass(obj, NetworkConnector) and obj is not NetworkConnector:
                            # Instantiate temporarily just to get the vendor property
                            temp_instance = obj()
                            vendor_m = temp_instance.vendor.lower()
                            cls._connectors[vendor_m] = obj
                            logger.info(f"Loaded Connector Plugin: '{name}' for vendor: '{vendor_m}'")
                except Exception as e:
                    logger.error(f"Failed to load plugin {module_name}: {e}")

        cls._is_loaded = True
        logger.info(f"Connector Registry initialized. Registered vendors: {list(cls._connectors.keys())}")

    @classmethod
    def get_connector(cls, vendor: str) -> Optional[NetworkConnector]:
        """Get an instance of a connector for the specified vendor."""
        if not cls._is_loaded:
            cls.load_connectors()
            
        vendor_lower = vendor.lower()
        connector_class = cls._connectors.get(vendor_lower)
        
        if not connector_class:
            logger.warning(f"No connector found for vendor: {vendor_lower}")
            return None
            
        return connector_class()

    @classmethod
    def list_vendors(cls) -> list[str]:
        if not cls._is_loaded:
            cls.load_connectors()
        return list(cls._connectors.keys())
