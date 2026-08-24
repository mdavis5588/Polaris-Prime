import { makeStyles } from '@material-ui/core';

const useStyles = makeStyles({
  svg: {
    width: 'auto',
    height: 30,
  },
  text: {
    fontFamily: 'Arial, sans-serif',
    fontWeight: 700,
    fontSize: 22,
    fill: '#ffffff',
  },
  accent: {
    fill: '#8b5cf6',
  },
});

export const LogoFull = () => {
  const classes = useStyles();

  return (
    <svg
      className={classes.svg}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 190 30"
    >
      <text x="0" y="22" className={classes.text}>
        Polaris <tspan className={classes.accent}>Prime</tspan>
      </text>
    </svg>
  );
};
