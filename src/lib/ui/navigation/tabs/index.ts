import Root from "./root.svelte";
import Item from "./item.svelte";

export { Root, Item };

const Tabs = Root as typeof Root & {
	Item: typeof Item;
};

Tabs.Item = Item;

export default Tabs;
