from abc import ABC, abstractmethod
from typing import Any, Dict, List

class NetworkConnector(ABC):
    """
    Base class for all Network Operations Connectors.
    All vendor-specific connectors must implement these methods.
    """

    @property
    @abstractmethod
    def vendor(self) -> str:
        """Return the vendor string identifier (e.g., 'cisco', 'huawei')"""
        pass

    @abstractmethod
    def connect(self, host: str, credentials: Dict[str, str]) -> bool:
        """Establish a connection to the network device."""
        pass

    @abstractmethod
    def disconnect(self) -> None:
        """Close connection to the device."""
        pass

    @abstractmethod
    def get_config(self) -> str:
        """Retrieve the running configuration from the device."""
        pass

    @abstractmethod
    def apply_config(self, config_string: str) -> bool:
        """Apply a configuration snippet to the device."""
        pass

    @abstractmethod
    def execute_command(self, command: str) -> str:
        """Execute a raw command on the device."""
        pass

    # Helper function for intent parser mapping
    @abstractmethod
    def translate_intent(self, intent_type: str, params: Dict[str, Any]) -> List[str]:
        """Convert a standard high-level intent into vendor-specific configuration commands."""
        pass
