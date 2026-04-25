import Root from "./root.svelte";
import Trigger from "./trigger.svelte";
import Content from "./content.svelte";

export { Root, Trigger, Content };

const Dropdown = Root as typeof Root & {
	Trigger: typeof Trigger;
	Content: typeof Content;
};

Dropdown.Trigger = Trigger;
Dropdown.Content = Content;

export default Dropdown;
